/silent-command
listresources = {}
for a, b in pairs(game.player.force.recipes) do
    item = "{\r\n\t\"name\": \"" .. b.name .. "\",\r\n\t\"seconds\": " .. b.energy .. ",\r\n\t\"produces\": {\r\n"
	produces = {}
	for c,d in pairs (b.products) do
        if d.amount ~= nil then    
            produce_item = "\t\t\"" .. d.name .. "\": " .. d.amount
			table.insert(produces, produce_item)
        end
    end
	item = item .. table.concat(produces, ",\r\n")
	item = item .. "\r\n\t},\r\n\t\"ingredients\": {\r\n"
	ingredients = {}
    for x,y in pairs (b.ingredients) do
        ingredient_item = "\t\t\"" .. y.name .. "\": " .. y.amount
		table.insert(ingredients, ingredient_item)
    end
	item = item .. table.concat(ingredients, ",\r\n")
	item = item .. "\r\n\t}\r\n}"
    table.insert(listresources,item)
end
table.sort(listresources)
game.write_file("recipes.json", "[\r\n" .. table.concat(listresources, ",\r\n") .. "\r\n]")