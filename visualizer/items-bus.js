const allRecipes = recipes.concat(syntheticRecipes);

const excludedRecipesPatterns = [
    /empty-.+-barrel/,
    /fill-.+-barrel/
];

const recipeOverride = {
    "petroleum-gas": "advanced-oil-processing",
    "heavy-oil": "advanced-oil-processing",
    "light-oil": "advanced-oil-processing",
    "solid-fuel": "solid-fuel-from-light-oil"
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

Array.prototype.lazyMap = function*(fn) {
    for(let x of this)
        yield fn(x);
}

function find(a, fn = (x => x)) {
    for(let x of a)
        if (fn(x))
            return x;
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
        this.inputBuses.forEach(bus => bus.connect());
        this.outputBus.connect();
        this.produces.forEach(productName => {
            this.outputBus.put(this.reduceRecipesForProduct(productName));
        });
        this.inputBuses.forEach(bus => bus.disconnect());
        this.outputBus.disconnect();
    }

    reduceRecipesForProduct(productName) {
        const product = this.initItem(productName);
        const input = find(this.inputBuses.lazyMap(bus => bus.take(productName)));
        if(input) {
            product.ingredients[input.connection.name] = 1;
        } else {
            const recipesForProduct = recipeOverride[productName]?.let(overrideName => [recipesByName[overrideName]]) || recipesByProduct[productName];
            console.log({recipesForProduct});
            console.assert(recipesForProduct?.length > 0, "No recipe found", {productName});
            console.assert(recipesForProduct.length == 1, "More than 1 recipe found", {productName, recipesForProduct});
            this.reduceRecipe(recipesForProduct[0]);
        }
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
                isIncluded: true,
                recipe: {},
                originalRecipe: {}
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
        this.outputs = {};
        this.connection = null;
        this.connectionIndex = -1;
        this.lastConnectionItem = null;
        this.connect();
        (outputs || []).forEach(output => {
            this.put(output, false);
        });
        this.disconnect();
    }

    makeLocalName(itemName) {
        return itemName + "-" + this.name;
    }

    put(output, includeIngredients = true) {
        const name = output.name;
        const localName = this.makeLocalName(name);
        const item = {
            name,
            displayName: localName,
            ingredients: { [this.findInputConnectionItem().name]: 1 },
            isIncluded: true,
            recipe: {},
            originalRecipe: {} // for compatibility
        };
        if(includeIngredients) {
            item.ingredients[output.displayName] = 1;
        }
        this.connection[localName] = item;
        return item;
    }

    take(itemName) {
        return this.outputs[this.makeLocalName(itemName)]?.let(x =>
            { return { ...x, connection: this.findOutputConnectionItem() }; }
        );
    }

    findOutputConnectionItem() {
        const outputConnectionName = this.currentConnectionName() + "-out";
        if(!this.connection[outputConnectionName]) {
            const outputConnectionItem = naturalItem(outputConnectionName);
            this.lastConnectionItem?.let(item => {outputConnectionItem.ingredients[item.name] = 1} );
            this.connection[outputConnectionName] = outputConnectionItem;
            this.lastConnectionItem = outputConnectionItem;
        }
        return this.connection[outputConnectionName];
    }

    findInputConnectionItem() {
        const inputConnectionName = this.currentConnectionName() + "-in";
        if(!this.connection[inputConnectionName]) {
            const inputConnectionItem = naturalItem(inputConnectionName);
            this.lastConnectionItem?.let(item => {inputConnectionItem.ingredients[item.name] = 1} );
            this.connection[inputConnectionName] = inputConnectionItem;
            this.lastConnectionItem = inputConnectionItem;
        }
        return this.connection[inputConnectionName];
    }

    currentConnectionName() {
        return this.name + "-" + this.connectionIndex
    }

    connect() {
        if(null === this.connection) {
            this.connectionIndex++;
            this.connection = {};
        }
    }

    disconnect() {
        if(null != this.connection) {
            Object.assign(this.outputs, this.connection);
            this.connection = null;
        }
    }
}

const base = {};
base["oreBus"] = new Bus("ore", [naturalItem("iron-ore"), naturalItem("copper-ore"), naturalItem("stone")]);
base["oilBus"] = new Bus("oil", [naturalItem("water"), naturalItem("crude-oil")]);
base["mainBus"] = new Bus("main", [/*HACK*/ naturalItem("water"), naturalItem("coal")]);
base["forge"] = new Peripheral("forge", ["iron-plate", "steel-plate", "copper-plate", "stone-brick", "stone"], base["oreBus"], base["mainBus"]);
base["oil"] = new Peripheral("oil", ["petroleum-gas", "lubricant", "light-oil", "sulfur", "sulfuric-acid", "battery", "plastic-bar"], [base["oilBus"], base["mainBus"]], base["mainBus"]);
base["researchBus"] = new Bus("research");
base["rocketBus"] = new Bus("rocket");
base["electronic-circuits"] = new Peripheral("electronic-circuits", ["electronic-circuit"], base["mainBus"], base["mainBus"]);
base["advanced-circuits"] = new Peripheral("advanced-circuits", ["advanced-circuit"], base["mainBus"], base["mainBus"]);
base["processing-units"] = new Peripheral("processing-units", ["processing-unit"], base["mainBus"], base["mainBus"]);
base["automation-science"] = new Peripheral("automation-science", ["automation-science-pack"], base["mainBus"], base["researchBus"]);
base["logistic-science"] = new Peripheral("logistic-science", ["logistic-science-pack"], base["mainBus"], base["researchBus"]);
base["chemical-science"] = new Peripheral("chemical-science", ["chemical-science-pack"], base["mainBus"], base["researchBus"]);
base["military-science"] = new Peripheral("military-science", ["military-science-pack"], base["mainBus"], base["researchBus"]);
base["production-science"] = new Peripheral("production-science", ["production-science-pack"], base["mainBus"], base["researchBus"]);
base["utility-science"] = new Peripheral("utility-science", ["utility-science-pack"], base["mainBus"], base["researchBus"]);
base["research"] = new Peripheral("research", ["research"], base["researchBus"], base["researchBus"]);
base["rocket-launch"] = new Peripheral("rocket-launch", ["rocket-launch"], base["mainBus"], base["rocketBus"]);
allItems = Object.values(base).reduce((x, y) => Object.assign(x, y.outputs), {});
