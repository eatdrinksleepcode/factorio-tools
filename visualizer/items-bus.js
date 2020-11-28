const busItems = [
    'iron-plate',
    'copper-plate',
    'steel-plate'
];

const excludedRecipesPatterns = [
    'empty-crude-oil-barrel',
    'fill-crude-oil-barrel',
    'empty-heavy-oil-barrel',
    'fill-heavy-oil-barrel',
    'empty-light-oil-barrel',
    'fill-light-oil-barrel',
    'empty-lubricant-barrel',
    'fill-lubricant-barrel',
    'empty-petroleum-gas-barrel',
    'fill-petroleum-gas-barrel',
    'empty-sulfuric-acid-barrel',
    'fill-sulfuric-acid-barrel',
    'empty-water-barrel',
    'fill-water-barrel'
];

function splitRecipesByProduct(recipes) {
    return recipes.filter(recipe => !excludedRecipesList.includes(recipe.name)).map(recipe => {
        return Object.keys(recipe.produces).map(productName => {
            return {
                originalRecipe: recipe,
                productName,
                quantity: recipe.produces[productName],
                ingredients: { ...recipe.ingredients },
            };
        });
    })
    .reduce((x, y) => x.concat(y))
    .reduce((list, recipe) => { 
        list[recipe.productName] = recipe;
        return list;
    }, {});
}

class ItemList {
    constructor(recipes) {
        this.recipes = recipes;
        this.recipesByProduct = splitRecipesByProduct(recipes);
        this.items = {};
        this.reduceRecipes();
    }

    reduceRecipes() {
        Object.values(this.recipesByProduct).forEach(recipe => {
            const item = this.mapProductRecipe(recipe);
            this.items[item.displayName] = item;
        });
    }

    mapProductRecipe(recipe) {
        var item = this.items[recipe.productName];
        if(item) {
            return item;
        }
        item = {
            originalRecipe: recipe.originalRecipe,
            name: recipe.productName,
            displayName: recipe.productName,
            ingredients: this.mapIngredients(recipe),
        };
        return item;
    }

    mapProductRecipeName(productName) {
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
