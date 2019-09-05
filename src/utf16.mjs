export function getChar(code)
{
	if (code >= 0xd800 && code <= 0xdfff)
	{
		throw new Error('invalid character code in the reserved surrogate range');
	}

	if (code > 0x10ffff)
	{
		throw new Error('invalid character code outside the supported UTF-16 range');
	}

	if (code >= 0x010000)
	{
		const U = code - 0x10000;
		return String.fromCharCode(0xd800 | (U >> 10)) + String.fromCharCode(0xdc00 | (U & 0x3ff));
	}

	return String.fromCharCode(code);
}
