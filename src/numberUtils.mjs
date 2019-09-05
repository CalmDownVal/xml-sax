function hex(c)
{
	if (c > 47 && c < 58)
	{
		return c - 48;
	}

	if (c > 64 && c < 71)
	{
		return c - 55;
	}

	if (c > 96 && c < 103)
	{
		return c - 87;
	}

	return null;
}

export function parseHex(string, index0 = 0, index1 = string.length - 1)
{
	let value = 0;
	let order = 0;
	while (index1 >= index0)
	{
		const char = hex(string.charCodeAt(index1));
		if (char !== null)
		{
			value |= char << order;
			order += 4;
		}
		--index1;
	}
	return value;
}

export function parseDec(string, index0 = 0, index1 = string.length - 1)
{
	let value = 0;
	let order = 1;
	while (index1 >= index0)
	{
		const char = string.charCodeAt(index1);
		if (char > 47 && char < 58)
		{
			value += (string.charCodeAt(index1) - 48) * order;
			order *= 10;
		}
		--index1;
	}
	return value;
}
