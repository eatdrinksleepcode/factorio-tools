const allRecipes = recipes.concat(syntheticRecipes);

const excludedRecipesPatterns = [
    /empty-.+-barrel/,
    /fill-.+-barrel/
];

const recipeOverride = {
    "petroleum-gas": "advanced-oil-processing",
    "heavy-oil": "advanced-oil-processing"
};

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

Object.prototype.let = function(func) {
    return func(this);
}

function splitRecipesByProduct(recipes) {
    console.log("recipes: ", recipes.length)
    const includedRecipes = recipes.filter(recipe => !excludedRecipesPatterns.some(pattern => pattern.test(recipe.name)))
    console.log("includedRecipes: ", includedRecipes.length)
    return includedRecipes.flatMap(recipe => Object.keys(recipe.produces).map(productName => ({ productName, recipe })))
        .groupBy(x => x.productName, x => x.recipe);
}

recipesByProduct = splitRecipesByProduct(allRecipes);
recipesByName = allRecipes.reduce((list, recipe) => {
    list[recipe.name] = recipe;
    return list;
}, {});

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
    constructor(name, produces, inputBuses, outputBus) {
        this.name = name;
        this.produces = [].concat(produces);
        this.items = {};
        this.inputBuses = Array.isArray(inputBuses) ? inputBuses : [inputBuses];
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
        const input = this.inputBuses.map(bus => bus.find(productName)).find(x => x);
        if(input) {
            return input;
        }
        const product = this.initItem(productName);
        const recipesForProduct = recipeOverride[productName]?.let(overrideName => [recipesByName[overrideName]]) || recipesByProduct[productName];
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
                product.ingredients[this.reduceRecipesForProduct(ingredientName).displayName] = recipe.ingredients[ingredientName];
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

class Bus {
    constructor(name, outputs) {
        this.name = name + "-bus";
        this.outputs = { [this.name]: naturalItem(this.name) };
        (outputs || []).forEach(output => {
            this.accept(output, false);
        });
    }

    makeLocalName(itemName) {
        return itemName + "-" + this.name;
    }

    accept(output, includeIngredients = true) {
        const name = output.name;
        const localName = this.makeLocalName(name);
        const item = {
            name,
            displayName: localName,
            ingredients: { [this.name]: 1 },
            isIncluded: true,
            recipe: {},
            originalRecipe: {} // for compatibility
        };
        if(includeIngredients) {
            item.ingredients[output.displayName] = 1;
        }
        this.outputs[localName] = item;
        return item;
    }

    includes(itemName) {
        return this.outputs[this.makeLocalName(itemName)];
    }

    find(itemName) {
        return this.outputs[this.makeLocalName(itemName)];
    }
}

const base = {};
base["oreBus"] = new Bus("ore", [naturalItem("iron-ore"), naturalItem("copper-ore"), naturalItem("stone")]);
base["oilBus"] = new Bus("oil", [naturalItem("water"), naturalItem("crude-oil")]);
base["mainBus"] = new Bus("main", [/*HACK*/ naturalItem("water"), naturalItem("coal")]);
base["oil"] = new Peripheral("oil", ["petroleum-gas", "heavy-oil", "sulfur", "plastic-bar"], [base["oilBus"], base["mainBus"]], base["mainBus"]);
base["researchBus"] = new Bus("research");
base["forge"] = new Peripheral("forge", ["iron-plate", "copper-plate", "stone-brick", "stone"], base["oreBus"], base["mainBus"]);
base["electronic-circuits"] = new Peripheral("electronic-circuits", ["electronic-circuit"], base["mainBus"], base["mainBus"]);
base["advanced-circuits"] = new Peripheral("advanced-circuits", ["advanced-circuit"], base["mainBus"], base["mainBus"]);
base["research"] = new Peripheral("research", ["research"], base["mainBus"], base["researchBus"]);
allItems = Object.values(base).reduce((x, y) => Object.assign(x, y.outputs), {});
