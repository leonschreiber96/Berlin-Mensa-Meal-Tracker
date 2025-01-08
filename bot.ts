import { TelegramBot, UpdateType } from "https://deno.land/x/telegram_bot_api@0.4.0/mod.ts"
import OpenAI from "https://deno.land/x/openai@v4.69.0/mod.ts";
import "jsr:@std/dotenv/load";

import CANTEENS from './canteen.ts';
import { MensaMenu } from "./types.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")
const DATA_FILE = Deno.env.get("DATA_FILE")
const MY_CHAT_ID = +(Deno.env.get("MY_CHAT_ID") || 0);
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

if (!OPENAI_API_KEY) {
   console.error("Please provide a OPENAI_API_KEY in the .env file");
   Deno.exit(1);
}

if (!MY_CHAT_ID) {
   console.error("Please provide a MY_CHAT_ID in the .env file");
   Deno.exit(1);
}

if (!TELEGRAM_BOT_TOKEN) {
   console.error("Please provide a TELEGRAM_BOT_TOKEN in the .env file");
   Deno.exit(1);
}

if (!DATA_FILE) {
   console.error("Please provide a DATA_FILE in the .env file");
   Deno.exit(1);
}

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN);
const openai = new OpenAI();

let inConversation = false;
let conversationStep = 0;
let mensaId = 0;
let userResponse: { date: string, mensa: string, userResponse: string, matchedItem: Record<string, { name: string, price: number }[]> } | undefined;

try {
   await Deno.readTextFile(DATA_FILE);
} catch (error) {
   if (error instanceof Deno.errors.NotFound) {
      console.log("No existing data file found. Creating one...");
      await saveData();
   } else {
      console.error("Error reading data file:", error);
   }
}

function resetConversation() {
   inConversation = false;
   conversationStep = 0;
   mensaId = 0;
   userResponse = undefined;
}

async function saveData() {
   const fullData = JSON.parse(Deno.readTextFileSync(DATA_FILE!));
   fullData.push(userResponse);
   await Deno.writeTextFile(DATA_FILE!, JSON.stringify(fullData, null, 2));
}

async function getGPTMatch(menu: MensaMenu, userResponse: string): Promise<Record<string, {name: string, price: number}[]>> {
   const salads = menu.menu.find(item => item.title === "Salate")?.meals || [];
   const soups = menu.menu.find(item => item.title === "Suppen")?.meals || [];
   const actions = menu.menu.find(item => item.title === "Aktionen")?.meals || [];
   const food = menu.menu.find(item => item.title === "Essen")?.meals || [];
   const sides = menu.menu.find(item => item.title === "Beilagen")?.meals || [];
   const desserts = menu.menu.find(item => item.title === "Desserts")?.meals || [];

   const prompt = `A user describes their lunch from a menu. Match the following with the json menu items" \n
      # Menu
      ## Salads: ${JSON.stringify(salads.map(item => ({ name: item.name, price: item.prices[0]})))}
      ## Soups: ${JSON.stringify(soups.map(item => ({ name: item.name, price: item.prices[0]})))}
      ## Actions: ${JSON.stringify(actions.map(item => ({ name: item.name, price: item.prices[0]})))}
      ## Food: ${JSON.stringify(food.map(item => ({ name: item.name, price: item.prices[0]})))}
      ## Sides: ${JSON.stringify(sides.map(item => ({ name: item.name, price: item.prices[0]})))}
      ## Desserts: ${JSON.stringify(desserts.map(item => ({ name: item.name, price: item.prices[0]})))} \n
      \nReturn only JSON (no markdown) of the matching menu items in the exact format: {JSON.stringify(category: [{name from the json menu, price}, ...]}
      \n if nothing matches, return an empty object`;
   
   const gptResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: prompt }, { role: 'user', content: userResponse }],
      max_tokens: 1000
   });

   return JSON.parse(gptResponse.choices[0].message.content || "{}");
}

async function sendWelcomeMessage(chatId:number) {
   await bot.sendMessage({
      chat_id: chatId,
      text: 'Welcome to the Mensa bot! I will ask you about your lunch every day in the evening. Let\'s get started!'
   });
}

async function askIfMensaToday(chatId: number) {
   inConversation = true;
   conversationStep = 1;

   const messageObject = {
      chat_id: chatId,
      text: 'Were you in a mensa today?',
      reply_markup: {
         inline_keyboard: [
            [
               { text: 'Yes', callback_data: 'yes' },
               { text: 'No', callback_data: 'no' }
            ]
         ]
      }
   };

   await bot.sendMessage(messageObject);
}

async function askWhichMensa(chatId: number) {
   conversationStep = 2;

   const mensas = CANTEENS.map(canteen => canteen.name);
   const messageObject = {
      chat_id: chatId,
      text: 'In which mensa were you?',
      reply_markup: {
         inline_keyboard: mensas.map((mensa) => [{ text: mensa, callback_data: mensa }])
      }
   };

   await bot.sendMessage(messageObject);
}

async function askWhatUserHad(chatId: number) {
   conversationStep = 3;
   const messageObject = {
      chat_id: chatId,
      text: "What did you have for lunch today?",
   }

   await bot.sendMessage(messageObject);
}

async function handleUserMealResponse(chatId: number, mealResponse: string) {
   if (!inConversation) {
      await askIfMensaToday(chatId);
      return;
   }
   else if (conversationStep === 1) {
      if (mealResponse === 'no') {
         await bot.sendMessage({ chat_id: chatId, text: 'Alright, see you tomorrow!' });
         resetConversation();
         return;
      } else if (mealResponse === 'yes') {
         await askWhichMensa(chatId);
         return;
      } else {
         await bot.sendMessage({ chat_id: chatId, text: 'Invalid response. Please try again.' });
         return;
      }
   } else if (conversationStep === 2) {
      await askWhatUserHad(chatId);
      return;
   }

   const menu = await getMenu(mensaId);
   const matchedItems = await getGPTMatch(menu, mealResponse);
   // const matchedItems = { Sides: [ { name: "Paprika-Zucchini-Gemüse", price: 0.85 } ] };

   // userResponses[chatId] = { date: new Date().toISOString(), mensa: '', userResponse, matchedItem };
   // await saveData();

   const readableMatch = Object.entries(matchedItems).map(([category, items]) => {
      if (items.length === 0) return '';
      const itemNames = items.map(item => item.name).join(', ');
      return `<b>${category}:</b> ${itemNames}  `;
   }
   ).filter(x => x !== "").join('\n');

   const totalPrice = Object.entries(matchedItems).reduce((acc, [_, items]) => {
      if (items.length === 0) return acc;
      const totalPrice = items.reduce((acc, item) => acc + item.price, 0);
      return acc + totalPrice;
   }, 0);

   if (userResponse) {
      userResponse.userResponse = mealResponse;
      userResponse.matchedItem = matchedItems;
   }
   
   const text = `Thanks! Based on your description, you likely had:\n\n${readableMatch}\n\nand paid <code>${totalPrice.toFixed(2)}€</code>`

   await bot.sendMessage({
      chat_id: chatId,
      text: text,
      parse_mode: 'html',
      reply_markup: {
         inline_keyboard: [
            [{ text: 'Correct', callback_data: 'correct' }, { text: 'Incorrect', callback_data: 'incorrect' }]
         ]
      }
   });
}

async function getMenu(mensaId: number) : Promise<MensaMenu> {
   const url = `https://mensa.leonschreiber.de/api/menu/${mensaId}?includeHistoric=true`;
   const response = await fetch(url);
   const data = await response.json() as MensaMenu;
   
   return data;
}

bot.on(UpdateType.Message, async ({ message }) => {
   if (message.from?.id !== MY_CHAT_ID) return;
   else if (message.text === "/start") {
      await sendWelcomeMessage(message.chat.id);
      resetConversation();
   }
   else if (message.text === "/cancel") resetConversation();
   else if (inConversation && conversationStep === 3) handleUserMealResponse(message.chat.id, message.text || "");
   else await askIfMensaToday(message.chat.id);

});

bot.on(UpdateType.CallbackQuery, async ({ callback_query }) => {
   const { id, data, from } = callback_query;

   if (data !== 'no' && data !== 'yes') return;

   if (from.id !== MY_CHAT_ID) return;

   if (data === 'no') {
      await bot.sendMessage({ chat_id: from.id, text: 'Alright, see you tomorrow!' });
      return;
   }

   if (data === 'yes') {
      userResponse = { date: new Date().toISOString(), mensa: '', userResponse: '', matchedItem: {} };
      await askWhichMensa(from.id);
   }

   await bot.answerCallbackQuery({ callback_query_id: id });
});

bot.on(UpdateType.CallbackQuery, async ({ callback_query }) => {
   const { data, from } = callback_query;

   if (data === 'no' || data === 'yes' || data === "correct" || data === "incorrect") return;

   if (from.id !== MY_CHAT_ID) return;
   
   const mensaName = data
   const mensa = CANTEENS.find(canteen => canteen.name === mensaName);

   if (!mensa) {
      await bot.sendMessage({ chat_id: callback_query.from.id, text: 'Invalid mensa selected. Please try again.' });
      return;
   }

   mensaId = mensa.id;
   if (userResponse) userResponse.mensa = mensa.name;

   bot.answerCallbackQuery({ callback_query_id: callback_query.id });

   await askWhatUserHad(callback_query.from.id);
});

bot.on(UpdateType.CallbackQuery, async ({ callback_query }) => {
   const { data, from } = callback_query;

   if (data !== 'correct' && data !== 'incorrect') return;

   if (from.id !== MY_CHAT_ID) return;

   if (data === 'correct') {
      await bot.sendMessage({ chat_id: from.id, text: 'Great! Thanks for confirming!' });
      resetConversation();
   } else if (data === 'incorrect') {
      await bot.sendMessage({ chat_id: from.id, text: 'Oops! Let\'s try again.' });
      await askWhatUserHad(from.id);
   }

   await bot.answerCallbackQuery({ callback_query_id: callback_query.id });
});

bot.run({ polling: true });

Deno.cron("Ask for daily meal", { hour: { exact: [15] } }, () => {
   // Schedule random between 15:00 and 20:00
   const ms = Math.random() * 1000 * 60 * 60 * 5;

   setTimeout(() => {
      askIfMensaToday(MY_CHAT_ID);
   }, ms);
});