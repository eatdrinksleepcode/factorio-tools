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

class Peripheral {
    constructor(name, produces, inputBuses, outputBus) {
        this.name = name;
        this.produces = [].concat(produces);
        this.items = {};
        this.inputBuses = Array.isArray(inputBuses) ? inputBuses : [inputBuses];
        this.outputBus = outputBus;
        this.reduceOutputs();
    }

    reduceOutputs() {
        this.inputBuses.forEach(bus => bus.connect());
        this.outputBus?.connect();
        this.produces.forEach(productName => {
            const outputItem = this.reduceRecipesForProduct(productName);
            this.outputBus?.put(outputItem);
        });
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
        this.connectionIndex = 0;
        this.lastConnectionItem = null;
        this.items = {};
        this.outputs = {};
        this.connect();
        (outputs || []).forEach(output => {
            output.displayName += "-" + this.name;
            this.put(output, false);
            this.items[output.displayName] = output;
        });
    }

    makeLocalName(itemName) {
        return itemName + "-" + this.name;
    }

    put(item, includeIngredients = true) {
        this.findInputConnectionItem().ingredients[item.displayName] = 1;
        if(includeIngredients) {
            item.ingredients[item.displayName] = 1;
        }
        this.outputs[item.name] = item;
        return item;
    }

    take(itemName) {
        return this.outputs[itemName]?.let(x =>
            { return { ...x, connection: this.findOutputConnectionItem() }; }
        );
    }

    findOutputConnectionItem(create = true) {
        const outputConnectionName = this.currentConnectionName() + "-out";
        if(create && !this.items[outputConnectionName]) {
            const outputConnectionItem = naturalItem(outputConnectionName);
            this.lastConnectionItem?.let(item => {outputConnectionItem.ingredients[item.name] = 1} );
            this.items[outputConnectionName] = outputConnectionItem;
            this.lastConnectionItem = outputConnectionItem;
        }
        return this.items[outputConnectionName];
    }

    findInputConnectionItem(create = true) {
        const inputConnectionName = this.currentConnectionName() + "-in";
        if(create && !this.items[inputConnectionName]) {
            const inputConnectionItem = naturalItem(inputConnectionName);
            this.lastConnectionItem?.let(item => {inputConnectionItem.ingredients[item.name] = 1} );
            this.items[inputConnectionName] = inputConnectionItem;
            this.lastConnectionItem = inputConnectionItem;
        }
        return this.items[inputConnectionName];
    }

    currentConnectionName() {
        return this.name + "-" + this.connectionIndex
    }

    connect() {
        if(this.findOutputConnectionItem(false) || this.findInputConnectionItem(false)) {
            this.connectionIndex++;
        }
    }
}

const base = {
    buses: {
        ore: [naturalItem("iron-ore"), naturalItem("copper-ore"), naturalItem("stone")],
        oil: [naturalItem("water"), naturalItem("crude-oil")],
        main: [/*HACK*/naturalItem("water"), naturalItem("coal")],
        research: [],
    },
    peripherals: {
        forge: {
            source: "ore",
            target: "main",
            outputs: ["iron-plate", "steel-plate", "copper-plate", "stone", "stone-brick"]
        },
        oil: {
            sources: ["oil", "main"],
            target: "main",
            outputs: ["petroleum-gas", "lubricant", "light-oil", "sulfur", "sulfuric-acid", "battery", "plastic-bar"]
        },
        "green-circuits": {
            source: "main",
            target: "main",
            output: "electronic-circuit"
        },
        "red-circuits": {
            source: "main",
            target: "main",
            output: "advanced-circuit"
        },
        "blue-circuits": {
            source: "main",
            target: "main",
            output: "processing-unit"
        },
        "automation-science": {
            source: "main",
            target: "research",
            output: "automation-science-pack"
        },
        "logistic-science": {
            source: "main",
            target: "research",
            output: "logistic-science-pack"
        },
        "military-science": {
            source: "main",
            target: "research",
            output: "military-science-pack"
        },
        "chemical-science": {
            source: "main",
            target: "research",
            output: "chemical-science-pack"
        },
        "production-science": {
            source: "main",
            target: "research",
            output: "production-science-pack"
        },
        "utility-science": {
            source: "main",
            target: "research",
            output: "utility-science-pack"
        },
        research: {
            source: "research",
            output: "research"
        },
        rocket: {
            source: "main",
            output: "rocket-launch"
        },
        robots: {
            source: "main",
            outputs: ["construction-robot", "logistic-robot"]
        }
    }
};

const buses = Object.keys(base.buses).reduce((result, busName) => {
    result[busName] = new Bus(busName, base.buses[busName]);
    return result;
}, {});
const peripherals = Object.keys(base.peripherals).map(peripheralName => base.peripherals[peripheralName].let(peripheral => new Peripheral(
    peripheralName,
    peripheral.outputs || [peripheral.output],
    peripheral.sources?.let(sources => sources.map(sourceName => buses[sourceName])) || [buses[peripheral.source]],
    buses[peripheral.target]
)));
allItems = Object.values({...buses, ...peripherals}).reduce((x, y) => Object.assign(x, y.items), {});
