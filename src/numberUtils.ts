function hex(cc: number)
{
	if (cc > 47 && cc < 58)
	{
		return cc - 48;
	}

	if (cc > 64 && cc < 71)
	{
		return cc - 55;
	}

	if (cc > 96 && cc < 103)
	{
		return cc - 87;
	}

	// return undefined;
}

export function parseHex(str: string, startIndex = 0, endIndex = str.length - 1)
{
	let value = 0;
	let order = 0;
	let index = endIndex;
	while (index >= startIndex)
	{
		const char = hex(str.charCodeAt(index));
		if (char !== undefined)
		{
			value |= char << order;
			order += 4;
		}
		--index;
	}
	return value;
}

export function parseDec(str: string, startIndex = 0, endIndex = str.length - 1)
{
	let value = 0;
	let order = 1;
	let index = endIndex;
	while (index >= startIndex)
	{
		const char = str.charCodeAt(index);
		if (char > 47 && char < 58)
		{
			value += (str.charCodeAt(index) - 48) * order;
			order *= 10;
		}
		--index;
	}
	return value;
}
