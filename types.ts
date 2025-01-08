export type Canteen = {
   id: number;
   name: string;
};

export type Allergen = {
   id: string;
   name: string;
};

export type Meal = {
   name: string;
   prices: (number | null)[];
   co2Value: string | null;
   co2Info: string | null;
   waterValue: string | null;
   waterInfo: string | null;
   mealAllergens: Allergen[];
   ampelValue: number;
   dietValue: "Vegan" | "Vegetarisch" | null;
};

export type MenuSection = {
   title: string;
   meals: Meal[];
};

export type MensaMenu = {
   date: string;
   canteen: Canteen;
   menu: MenuSection[];
};