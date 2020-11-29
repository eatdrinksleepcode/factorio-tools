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
        // Group initialization
        const key = keySelector(item);
        if (!acc[key]) {
            acc[key] = [];
        }
    
        const value = valueSelector(item);
        // Grouping
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
        this.recipesByProduct = splitRecipesByProduct(recipes);
        this.items = {};
        // this.reduceAllRecipes();
        this.reduceTargetRecipes();
    }

    reduceTargetRecipes() {
        [
            "automation-science-pack",
            "logistic-science-pack",
            "chemical-science-pack"
        ].forEach(productName => this.reduceRecipesForProduct(productName));
    }

    reduceAllRecipes() {
        Object.keys(this.recipesByProduct).forEach(productName => {
            this.reduceRecipesForProduct(productName);
        });
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

    mapProductRecipe(recipe) {
        console.log("mapProductRecipe", {recipeName: recipe.originalRecipe.name, productName: recipe.productName})
        var item = this.items[recipe.productName];
        if(item) {
            return item;
        }
        item = {
            originalRecipe: recipe.originalRecipe,
            name: recipe.productName,
            displayName: recipe.productName,
            ingredients: this.mapIngredients(recipe),
            isIncluded: true
        };
        return item;
    }

    mapProductRecipeName(productName) {
        console.log("mapProductRecipeName", {productName})
        var result = this.items[productName];
        if(!result) {
            const recipe = this.recipesByProduct[productName];
            if(!recipe) {
                result = {
                    name: productName,
                    displayName: productName,
                    ingredients: {},
                    originalRecipe: {},
                };
            } else {
                result = this.mapProductRecipe(recipe);
            }
            this.items[productName] = result;
        }
        return result;
    }

    mapIngredients(recipe) {
        return Object.entries(recipe.ingredients).filter(([ingredientName]) => ingredientName !== recipe.productName).reduce((ingredients, [ingredientName, ingredientQuantity]) => {
            const ingredient = this.mapProductRecipeName(ingredientName);
            ingredients[ingredient.displayName] = ingredientQuantity;
            return ingredients;
        }, {});
    }

};
