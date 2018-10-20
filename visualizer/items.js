const basics = [
    'stone',
    'coal',
    'crude-oil',
    'water',

    'iron-plate',
    'iron-gear-wheel',
    'steel-plate',
    'pipe',

    'engine-unit',

    'copper-plate',
    'copper-cable',

    'steam',

    'electronic-circuit',
    'advanced-circuit',
    'plastic-bar',

    'lubricant',
];

const exclusions = {
    ores: ['iron-ore', 'copper-ore'],
    guns: ['pistol', 'submachine-gun', 'shotgun', 'combat-shotgun', 'railgun', 'rocket-launcher', 'flamethrower'],
    vehicles: ['car', 'tank', 'locomotive', 'fluid-wagon', 'cargo-wagon', 'artillery-wagon'],
    limited: ['rocket-silo', 'resource-monitor', 'small-plane', 'oil-refinery', 'lab'],
    editor: ['player-port', 'loader', 'fast-loader', 'express-loader'],
};

const exclusionsList = flatten(exclusions);

const excludedRecipesList = ['coal-liquefaction', 'lubricant', 'plastic-bar'];

const groups = {
    oil: [
        'heavy-oil',
        'light-oil',
        'petroleum-gas',
    ],
    transport: [
        'inserter',
        'long-handed-inserter',
        'fast-inserter',
        'filter-inserter',
        'stack-inserter',
        'stack-filter-inserter',

        'transport-belt',
        'fast-transport-belt',
        'express-transport-belt',

        'underground-belt',
        'fast-underground-belt',
        'express-underground-belt',

        'science-pack-2',
    ],
    first: [
        'science-pack-1',
    ],
    military: [
        'gun-turret',
        'grenade',
        'piercing-rounds-magazine',
        'military-science-pack',
    ],
    power: [
        'accumulator',
    ],
    production: [
        'electric-engine-unit',
        'electric-furnace',
        'production-science-pack',
    // ],
    // robots: [
        'roboport',
        'flying-robot-frame',
        'construction-robot',
        'logistic-robot',
    ],
    'high-tech': [
        'processing-unit',
        'speed-module',
        'high-tech-science-pack',
    ],
};

const included = ['solar-panel'];

const fusionRecipes = [
    {
        "name": "iron-plate-and-gear-wheel",
        "seconds": 0,
        "isFusion": true,
        "produces": {
            "iron-plate-and-gear-wheel": 1
        },
        "ingredients": {
            "iron-plate": 1,
            "iron-gear-wheel": 1,
        },
        "images": [
            "iron-plate",
            "iron-gear-wheel",
        ],
    },
];

const comboRecipes = [
    {
        "name": "research",
        "seconds": 0,
        "produces": {
            "research": 1
        },
        "ingredients": {
            "science-pack-1": 1,
            "science-pack-2": 1,
            "science-pack-3": 1,
            "military-science-pack": 1,
            "production-science-pack": 1,
            "high-tech-science-pack": 1,
        },
        "images": [
            "lab"
        ],
    },
    {
        "name": "rocket-launch",
        "seconds": 0,
        "produces": {
            "rocket-launch": 1,
        },
        "ingredients": {
            "rocket-part": 100,
            "satellite": 1,
        },
        "images": [
            "rocket-silo",
        ],
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
        this.fusionRecipesByProduct = splitRecipesByProduct(fusionRecipes);
        this.items = {};
        this.allBasics = basics;
        this.reduceFusionRecipes();
        this.allBasics = basics.concat(Object.keys(this.fusionRecipesByProduct)); // HACK: this only works if all fusion recipes are for basic products
        this.reduceRecipes();
        this.reduceComboRecipes();
    }

    reduceFusionRecipes() {
        Object.values(this.fusionRecipesByProduct).forEach(recipe => {
            const item = this.mapProductRecipe(recipe);
            item.isFusion = true;
            this.items[item.displayName] = item;
        });
    }

    reduceRecipes() {
        Object.values(this.recipesByProduct).forEach(recipe => {
            const item = this.mapProductRecipe(recipe);
            this.items[item.displayName] = item;
        });
    }

    reduceComboRecipes() {
        const comboRecipesByProduct = splitRecipesByProduct(comboRecipes);
        Object.values(comboRecipesByProduct).forEach(recipe => {
            const item = this.mapProductRecipe(recipe);
            item.isIncluded = true;
            this.includeAllIngredients(item);
            this.items[item.displayName] = item;
        });
    }

    makeItemName(baseName, groupName) {
        if(groupName && this.allBasics.includes(baseName)) {
            return [baseName, groupName].filter(x => x).join("-");
        }
        return baseName;
    }

    findRecipe(productName) {
        return this.recipesByProduct[productName] || this.fusionRecipesByProduct[productName];
    }

    mapProductRecipeName(productName, groupName) {
        const displayName = this.makeItemName(productName, groupName);
        var result = this.items[displayName];
        if(!result) {
            const recipe = this.findRecipe(productName);
            if(!recipe) {
                result = {
                    name: productName,
                    displayName,
                    ingredients: {},
                    isExcluded: matchesExclusionPattern(productName),
                    originalRecipe: {},
                };
            } else {
                result = this.mapProductRecipe(recipe, groupName);
            }
            this.items[displayName] = result;
        }
        return result;
    }

    mapProductRecipe(recipe, targetGroupName) {
        const displayName = this.makeItemName(recipe.productName, targetGroupName);
        var item = this.items[displayName];
        if(item) {
            return item;
        }
        const groupName = groupsByProduct[recipe.productName] || targetGroupName;
        const isIncluded = groupName || included.includes(recipe.productName);
        const isExcluded = matchesExclusionPattern(recipe.productName);
        item = {
            originalRecipe: recipe.originalRecipe,
            name: recipe.productName,
            displayName,
            groupName,
            isIncluded,
            isExcluded,
            ingredients: isExcluded ? {} : this.mapIngredients(recipe, groupName),
        };
        if(item.isIncluded) {
            this.includeAllIngredients(item);
        }
        return item;
    }

    includeAllIngredients(item) {
        Object.keys(item.ingredients).forEach(ingredientName => {
            const ingredientItem = this.items[ingredientName];
            ingredientItem.isIncluded = true;
            this.includeAllIngredients(ingredientItem);
        });
    }

    mapIngredients(recipe, groupName) {
        const ingredients = recipe.ingredients;
        if(!recipe.originalRecipe.isFusion && groupName) {
            fusionRecipes.forEach(fusion => {
                if(Object.keys(fusion.ingredients).every(fusionIngredientName => ingredients.hasOwnProperty(fusionIngredientName))) {
                    Object.keys(fusion.ingredients).forEach(fusionIngredientName => {
                        delete ingredients[fusionIngredientName];
                    });
                    Object.keys(fusion.produces).forEach(fusionProductName => {
                        ingredients[fusionProductName] = fusion.produces[fusionProductName];
                    });
                }
            });
        }
        return Object.entries(recipe.ingredients).filter(([ingredientName]) => ingredientName !== recipe.productName).reduce((ingredients, [ingredientName, ingredientQuantity]) => {
            const ingredient = this.mapProductRecipeName(ingredientName, groupName);
            if(!ingredient.isExcluded) {
                ingredients[ingredient.displayName] = ingredientQuantity;
            }
            return ingredients;
        }, {});
    }
}
