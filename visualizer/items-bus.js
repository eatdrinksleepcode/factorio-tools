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

recipesByProduct = splitRecipesByProduct(recipes);

const peripherals = {
    "automation-science": {
        produces: {
            "automation-science-pack": 1
        }
    },
    "logistic-science": {
        produces: {
            "logistic-science-pack": 1
        }
    }
};

class Peripheral {
    constructor(name, produces, inputBus, outputBus) {
        this.name = name;
        this.produces = [].concat(produces);
        this.items = {};
        this.inputBus = inputBus;
        this.outputBus = outputBus;
        this.reduceOutputs();
        this.outputs = this.items; // HACK
    }

    reduceOutputs() {
        this.produces.forEach(productName => {
            this.outputBus.accept(this.reduceRecipesForProduct(productName));
        });
    }

    reduceRecipesForProduct(productName) {
        const product = this.initItem(productName);
        const recipesForProduct = recipesByProduct[productName];
        console.log({recipesForProduct});
        console.assert(recipesForProduct?.length > 0, "No recipe found", {productName});
        console.assert(recipesForProduct.length == 1, "More than 1 recipe found", {productName, recipesForProduct});
        this.reduceRecipe(recipesForProduct[0]);
        return product;
    }

    reduceRecipe(recipe) {
        Object.keys(recipe.produces).forEach(productName => {
            const product = this.initItem(productName);
            product.recipe = recipe;
            product.originalRecipe = recipe; // for compatibility
            product.isIncluded = true;
            Object.keys(recipe.ingredients).forEach(ingredientName => {
                if(this.inputBus.includes(ingredientName)) { 
                    product.ingredients[this.inputBus.find(ingredientName).displayName] = recipe.ingredients[ingredientName]
                } else {
                    product.ingredients[this.reduceRecipesForProduct(ingredientName).displayName] = recipe.ingredients[ingredientName];
                }
            });
        });
    }

    initItem(name) {
        const localName = name + "-" + this.name;
        if(!this.items[localName]) {
            this.items[localName] = {
                name,
                displayName: localName,
                ingredients: {},
                isIncluded: true
            };
        }
        return this.items[localName];
    }
}

class Bus {
    constructor(outputs) {
        this.outputs = {};
        (outputs || []).forEach(output => {
            this.accept(output).ingredients = {};
        });
    }

    makeLocalName(itemName) {
        return itemName + "-bus";
    }

    accept(output) {
        const name = output.name;
        const localName = this.makeLocalName(name);
        this.outputs[localName] = {
            name,
            displayName: localName,
            ingredients: { [output.displayName]: 1 },
            isIncluded: true,
            recipe: {},
            originalRecipe: {} // for compatibility
        };
        return this.outputs[localName];
    }

    includes(itemName) {
        return this.outputs[this.makeLocalName(itemName)];
    }

    find(itemName) {
        return this.outputs[this.makeLocalName(itemName)];
    }
}

function naturalItem(name) {
    return {
        name,
        displayName: name,
        ingredients: {},
        isIncluded: true,
        recipe: {},
        originalRecipe: {} // for compatibility
    };
}

const oreBus = new Bus([naturalItem("iron-ore"), naturalItem("copper-ore")]);
const mainBus = new Bus()
forge = new Peripheral("forge", ["iron-plate", "copper-plate"], oreBus, mainBus)
allItems = [
    oreBus,
    forge,
    mainBus
].reduce((x, y) => Object.assign(x, y.outputs), {});
