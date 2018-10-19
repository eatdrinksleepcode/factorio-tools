function flatten(iterable) {
    const results = [];
    iterateValues(iterable, x => iterateValues(x, y => results.push(y)));
    return results;
}

function iterateValues(iterable, valueFunc) {
    if(Array.isArray(iterable)) {
        iterable.forEach(valueFunc);
    } else {
        for(key in iterable) {
            valueFunc(iterable[key]);
        }
    }
}
