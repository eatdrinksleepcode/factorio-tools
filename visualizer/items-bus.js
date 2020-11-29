const busItems = [
    'iron-plate',
    'copper-plate',
    'steel-plate'
];

const alternateImages = {
    "battery-equipment": ["personal-battery"]
    // "battery-mk2-equipment": ["personal-battery-mk2"]
};

const excludedRecipesPatterns = [
    /empty-.+-barrel/,
    /fill-.+-barrel/
];

Array.prototype.groupBy = function(keySelector, valueSelector) {
    return this.reduce((acc, item) => {
        const key = keySelector(item);
        if (!acc[key]) {
            acc[key] = [];
        }
    
        const value = valueSelector(item);
        acc[key].push(value);
    
        return acc;
    }, {});
}

function splitRecipesByProduct(recipes) {
    console.log("recipes: ", recipes.length)
    const includedRecipes = recipes.filter(recipe => !excludedRecipesPatterns.some(pattern => pattern.test(recipe.name)))
    console.log("includedRecipes: ", includedRecipes.length)
    return includedRecipes.flatMap(recipe => Object.keys(recipe.produces).map(productName => ({ productName, recipe })))
        .groupBy(x => x.productName, x => x.recipe);
}

class ItemList {
    constructor(recipes) {
        this.recipes = recipes;
        this.recipesByProduct = splitRecipesByProduct(this.recipes);
        this.items = {};
        this.reduceTargetRecipes();
    }

    reduceTargetRecipes() {
        [
            "research",
            "rocket-launch"
        ].forEach(productName => this.reduceRecipesForProduct(productName));
    }

    reduceRecipesForProduct(productName) {
        this.initItem(productName);
        const recipesForProduct = this.recipesByProduct[productName];
        console.log({recipesForProduct});
        if(!recipesForProduct) return;
        console.assert(recipesForProduct.length == 1, {productName, recipesForProduct});
        this.reduceRecipe(recipesForProduct[0]);
    }

    reduceRecipe(recipe) {
        Object.keys(recipe.produces).forEach(productName => {
            const product = this.initItem(productName);
            product.recipe = recipe;
            product.originalRecipe = recipe; // for compatibility
            product.ingredients = recipe.ingredients;
            product.isIncluded = true;
            Object.keys(product.ingredients).forEach(ingredientName => {
                this.reduceRecipesForProduct(ingredientName);
            });
        });
    }

    initItem(name) {
        if(!this.items[name]) {
            this.items[name] = {
                name,
                displayName: name,
                images: alternateImages[name],
                ingredients: {}
            };
        }
        return this.items[name];
    }

};
