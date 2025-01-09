# Berlin Mensa Meal Tracker Bot 🥗🤖

A Telegram bot built using Deno that engages me daily to track what I had in Mensa for lunch that day (incl. prices).
It uses OpenAI's API to match the user's description of their lunch with the actual menu (provided by [my Mensa API](https://mensa.leonschreiber.de)) and logs the results.

## Features 🚀
- **Daily Meal Check**: The bot asks once per day whether I had lunch at a mensa and logs the response.
- **Menu Matching with AI**: Natural-language-described meals are matched with the menu using OpenAI's GPT 4o model.
- **Canteen Selection**: Supports multiple canteens with predefined IDs (see https://mensa.leonschreiber.de/api/canteens).
- **Scheduling**: Asks me at a random time between 15:00 and 20:00 every day.

## Tech Stack 🛠️
- **Deno**: Runtime for the bot and scheduling.
- **Telegram Bot API**: Handles interactions with users.
- **OpenAI API**: Processes user input and matches it with the menu.
- **Docker**: Deployment

## Setup Instructions 📝

### 1. Clone the repository
```bash
git clone https://github.com/your-username/mensa-bot.git
cd mensa-bot
```

### 2. Add a `.env` file
Create a `.env` file in the project root and add the following environment variables:
```bash
TELEGRAM_BOT_TOKEN=<your-telegram-bot-token>
MY_CHAT_ID=<your-chat-id>
OPENAI_API_KEY=<your-openai-api-key>
DATA_FILE=data.json
```

### 3. Run the bot locally
Ensure you have Deno installed and run the bot:
```bash
deno run --allow-net --allow-read --allow-write --allow-env --unstable-cron main.ts
```

### 4. Docker Build & Run
To build and run the bot in a Docker container:
```bash
docker build -t mensa-meal-tracker .
docker run mensa-meal-tracker
```

## How It Works 🤔
<img width="546" alt="image" src="https://github.com/user-attachments/assets/736b33f9-ece6-40f4-b12c-838c5a7c4ee4" />

## Supported Canteens 🍽️
This bot supports the following canteens (predefined in `canteen.ts`):
1. Mensa TU Hardenbergstraße
2. Mensa TU Marchstraße
3. Mensa Pastaria TU Architektur
4. Backshop TU Wetterleuchten
5. Mensa Pasteria TU Veggie 2.0 - Die vegane Mensa

Feel free to add more canteens by updating `canteen.ts` with data from https://mensa.leonschreiber.de/api/canteens.

