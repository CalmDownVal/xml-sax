export function getChar(cc: number)
{
	// char code must be within the UTF range and not be within the reserved surrogate pair ranges
	if (cc <= 0x10ffff && (cc < 0xd800 || cc > 0xdfff))
	{
		if (cc >= 0x010000)
		{
			const U = cc - 0x10000;
			return String.fromCharCode(0xd800 | (U >> 10)) + String.fromCharCode(0xdc00 | (U & 0x3ff));
		}

		return String.fromCharCode(cc);
	}

	// return undefined;
}
