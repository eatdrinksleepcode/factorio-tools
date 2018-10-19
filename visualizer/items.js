const basics = [
    'stone',
    'coal',
    'crude-oil',
    'water',

    'iron-plate',
    'iron-gear-wheel',
    'steel-plate',
    'pipe',

    'copper-plate',
    'copper-cable',

    'steam',

    'electronic-circuit'];

const exclusions = {
    guns: ['pistol', 'submachine-gun', 'shotgun', 'combat-shotgun', 'railgun', 'rocket-launcher', 'flamethrower'],
    vehicles: ['car', 'tank', 'locomotive', 'fluid-wagon', 'cargo-wagon', 'artillery-wagon'],
    limited: ['rocket-silo', 'resource-monitor', 'small-plane', 'oil-refinery', 'lab'],
    editor: ['player-port', 'loader', 'fast-loader', 'express-loader']
};

const exclusionsList = flatten(exclusions);

const excludedRecipesList = ['coal-liquefaction'];

const groups = {
    common: [
        'science-pack-1',

        'engine-unit',

        'firearm-magazine',
        'piercing-rounds-magazine',
    ],
    oil: [
        'heavy-oil',
        'light-oil',
        'petroleum-gas',
        'plastic-bar'
    ],
    transport: [
        'inserter',
        'long-handed-inserter',
        'fast-inserter',
        'filter-inserter',
        'stack-inserter',
        'stack-filter-inserter',

        'transport-belt',

        'science-pack-2',
    ],
};

const fusionRecipes = [
    {
        "name": "iron-plate-and-gear-wheel",
        "seconds": 0,
        "produces": {
            "iron-plate-and-gear-wheel": 1
        },
        "ingredients": {
            "iron-plate": 1,
            "iron-gear-wheel": 1,
        }
    },
];

const groupsByProduct = {};
for(groupName in groups) {
    iterateValues(groups[groupName], product => groupsByProduct[product] = groupName);
};

function matchesExclusionPattern(name) {
    if(name.endsWith('equipment')
        || name.includes('armor')
        || exclusionsList.includes(name)
        || name.endsWith('barrel')
        || name === 'water') {
        return true;
    }
    return false;
}

function makeItemName(baseName, groupName) {
    if(groupName && basics.includes(baseName)) {
        return [baseName, groupName].filter(x => x).join("-");
    }
    return baseName;
}

function splitRecipesByProduct(recipes) {
    return recipes.filter(recipe => !excludedRecipesList.includes(recipe.name)).map(recipe => {
        return Object.keys(recipe.produces).map(productName => {
            return {
                recipe,
                productName,
                quantity: recipe.produces[productName],
                ingredients: recipe.ingredients,
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

    mapProductRecipeName(productName, groupName) {
        const displayName = makeItemName(productName, groupName);
        var result = this.items[displayName];
        if(!result) {
            const recipe = this.recipesByProduct[productName];
            if(!recipe) {
                result = {
                    name: productName,
                    displayName,
                    ingredients: {},
                    isExcluded: true,
                };
            } else {
                result = this.mapProductRecipe(recipe, groupName);
            }
            this.items[displayName] = result;
        }
        return result;
    }
    
    mapProductRecipe(recipe, targetGroupName) {
        const groupName = groupsByProduct[recipe.productName] || targetGroupName;
        const isIncluded = groupName || basics.includes(recipe.productName);
        const isExcluded = matchesExclusionPattern(recipe.productName);
        const item = {
            recipe: recipe.recipe,
            name: recipe.productName,
            displayName: makeItemName(recipe.productName, targetGroupName),
            groupName,
            isIncluded,
            isExcluded,
            ingredients: isExcluded ? {} : this.mapIngredients(recipe, groupName),
        };
        if(item.isIncluded) {
            Object.keys(item.ingredients).forEach(ingredientName => {
                this.items[ingredientName].isIncluded = true;
            });
        }
        return item;
    }

    mapIngredients(recipe, groupName) {
        return Object.entries(recipe.ingredients).filter(([ingredientName]) => ingredientName !== recipe.productName).reduce((ingredients, [ingredientName, ingredientQuantity]) => {
            const ingredient = this.mapProductRecipeName(ingredientName, groupName);
            if(!ingredient.isExcluded) {
                ingredients[ingredient.displayName] = ingredientQuantity;
            }
            return ingredients;
        }, {});
    }
}
