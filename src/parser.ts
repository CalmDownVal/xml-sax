import { parseDec, parseHex } from './numberUtils';
import { getChar } from './utf16';

interface IEntityMap
{
	[name: string]: string | undefined;
}

export interface IParserOptions
{
	/**
	 * A map of known named entities to use when parsing.
	 */
	entities?: IEntityMap;

	/**
	 * Called whenever an attribute has been parsed.
	 */
	onAttribute?: (name: string, value: string | null) => void;

	/**
	 * Called whenever a CDATA block has been read.
	 */
	onCData?: (data: string) => void;

	/**
	 * Called whenever a comment has been parsed.
	 */
	onComment?: (data: string) => void;

	/**
	 * Called whenever a declaration has been parsed.
	 */
	onDeclaration?: (body: string, comment: string | null) => void;

	/**
	 * Called whenever a processing instruction has been parsed.
	 */
	onInstruction?: (target: string, body: string) => void;

	/**
	 * Called when a closing tag has been reached.
	 */
	onTagClose?: (name: string, isSelfClosing: boolean) => void;

	/**
	 * Called when a beginning of an opening tag is reached.
	 */
	onTagOpen?: (name: string) => void;

	/**
	 * Called once the entirety of an opening tag has been read.
	 */
	onTagOpenEnd?: (name: string) => void;

	/**
	 * Called whenever plain text was read.
	 */
	onText?: (text: string) => void;
}

export interface IParser
{
	/**
	 * Call this method once all data has been written to indicate the end of
	 * document. Once end() has been called the parser remains in a disposed
	 * state, calling write results in undefined behavior.
	 */
	end: () => void;

	/**
	 * Call this method to feed data to the parser, can be called many times.
	 */
	write: (chunk: string) => void;
}

// regular expressions
const RE_TAG_START = /^[^\s!?"#$%&'()[\]{}<>*+,/;=@\\^`|~]/;
const RE_WS = /^\s/;
const RE_QUOTE = /^["'`]/;

// cdata sequences
const CDATA_START = '[CDATA[';
const CDATA_END = ']]>';

// default known entities
const DEFAULT_ENTITIES: IEntityMap =
{
	amp: '&',
	apos: '\'',
	gt: '>',
	lt: '<',
	quot: '"'
};

// helpers
function assertNotNull<T>(obj: T): asserts obj is NonNullable<T>
{
	if (obj === null)
	{
		throw new Error('assertion failed: value is null');
	}
}

function noOp()
{
	// do nothing...
}

// parser phases (lowest 4 bits are reserved for sub-phases)
const P_PCDATA = 0;
const P_CANDIDATE = 16;
const P_DECLARATION = 32;
const P_CDATA = 48;

const P_INSTRUCTION_TARGET = 64;
const P_INSTRUCTION_BODY = 80;
const P_INSTRUCTION_END = 96;

const P_TAG_OPENING = 112;
const P_TAG_ATTR_QUOTED = 192;
const P_TAG_OPENING_SELF = 128;
const P_TAG_CLOSING_CANDIDATE = 144;
const P_TAG_CLOSING = 160;
const P_TAG_CLOSING_END = 176;

// P_TAG_OPENING sub-phases
const P_ATTR_SEEK_NAME = 113;
const P_ATTR_NAME = 114;
const P_ATTR_SEEK_EQ = 115;
const P_ATTR_SEEK_VALUE = 116;
const P_ATTR_VALUE = 117;

/**
 * Creates a SAX-style XML parser.
 * Parsing is stateful. Always create a new parser instance per document.
 */
export function createParser(
	{
		entities = DEFAULT_ENTITIES,
		onAttribute = noOp,
		onCData = noOp,
		onComment = noOp,
		onDeclaration = noOp,
		onInstruction = noOp,
		onTagClose = noOp,
		onTagOpen = noOp,
		onTagOpenEnd = noOp,
		onText = noOp
	}: IParserOptions = {}): IParser
{
	let current = '';
	let buffer = '';
	let quote = '';
	let isComment = false;
	let hyphens = 0;
	let index = 0;
	let phase = P_PCDATA;
	let anchorStart: number | null = 0;
	let anchorEnd: number | null = 0;
	let entityStart: number | null = null;
	let seqIndex: number | null = null;
	let instructionTarget: string | null = null;
	let declarationBody: string | null = null;
	let tagName: string | null = null;
	let attrName: string | null = null;

	const markStart = (includeCurrent = false) =>
	{
		buffer = '';
		anchorStart = index + (includeCurrent ? 0 : 1);
		anchorEnd = anchorStart;
	};

	const markEnd = () =>
	{
		anchorEnd = buffer.length + index;
	};

	const getMarked = (mark = true) =>
	{
		assertNotNull(anchorStart);
		assertNotNull(anchorEnd);

		if (mark)
		{
			markEnd();
		}

		const marked = (buffer + current).slice(anchorStart, anchorEnd);
		buffer = '';
		anchorStart = null;
		anchorEnd = null;

		return marked;
	};

	const markEntityStart = () =>
	{
		entityStart = buffer.length + index;
	};

	const getEntity = (name: string) =>
	{
		if (name[0] === '#')
		{
			const charCode = name[1] === 'x' ? parseHex(name, 2) : parseDec(name, 1);
			return getChar(charCode);
		}
		return entities[name];
	};

	const markEntityEnd = () =>
	{
		const offset = buffer.length + index;
		if (entityStart !== null && entityStart !== offset)
		{
			const concat = buffer + current;
			const entity = concat.slice(entityStart + 1, offset);
			const char = getEntity(entity);

			if (typeof char === 'string' && anchorStart !== null && anchorEnd !== null)
			{
				buffer = '';
				current = concat.slice(anchorStart, entityStart) + char + concat.slice(offset + 1);

				const diff = anchorStart + 2 + entity.length - char.length;
				index -= diff;
				anchorEnd -= diff;
				anchorStart = 0;
			}

			entityStart = null;
		}
	};

	/* eslint-disable sort-keys */
	const phases: { [phase: number]: (char: string) => void } =
	{
		[P_PCDATA](char)
		{
			if (anchorStart === null)
			{
				markStart(true);
			}

			switch (char)
			{
				case '<':
					markEnd();
					phase = P_CANDIDATE;
					break;

				case '&':
					markEntityStart();
					break;

				case ';':
					markEntityEnd();
					break;
			}
		},
		[P_CANDIDATE](char)
		{
			switch (char)
			{
				case '/':
					phase = P_TAG_CLOSING_CANDIDATE;
					break;

				case '!':
					seqIndex = 0;
					hyphens = 0;
					isComment = false;
					phase = P_DECLARATION;
					break;

				case '?':
					phase = P_INSTRUCTION_TARGET;
					break;

				default:
					if (RE_TAG_START.test(char))
					{
						phase = P_TAG_OPENING;
					}
					else
					{
						phase = P_PCDATA;
					}
					break;
			}

			if (phase !== P_PCDATA)
			{
				const text = getMarked(false);
				if (text)
				{
					onText(text);
				}
				markStart(phase === P_TAG_OPENING);
			}
		},
		[P_DECLARATION](char)
		{
			if (seqIndex !== null)
			{
				if (char === CDATA_START[seqIndex])
				{
					if (++seqIndex === CDATA_START.length)
					{
						markStart();
						seqIndex = 0;
						phase = P_CDATA;
					}
				}
				else
				{
					seqIndex = null;
				}
			}

			if (char === '-')
			{
				if (++hyphens === 1)
				{
					markEnd();
				}

				if (!isComment && hyphens === 2)
				{
					declarationBody = getMarked(false);
					markStart();
					isComment = true;
					hyphens = 0;
				}
			}
			else
			{
				if (isComment)
				{
					if (hyphens >= 2)
					{
						if (char === '>')
						{
							if (declarationBody)
							{
								onDeclaration(declarationBody, getMarked(false));
								declarationBody = null;
							}
							else
							{
								onComment(getMarked(false));
							}
							phase = P_PCDATA;
						}
					}
				}
				else if (char === '>')
				{
					onDeclaration(getMarked(), null);
					phase = P_PCDATA;
				}
				hyphens = 0;
			}
		},
		[P_CDATA](char)
		{
			assertNotNull(seqIndex);

			if (char === CDATA_END[seqIndex])
			{
				if (++seqIndex === 1)
				{
					markEnd();
				}

				if (seqIndex === CDATA_END.length)
				{
					onCData(getMarked(false));
					phase = P_PCDATA;
				}
			}
			else
			{
				seqIndex = 0;
			}
		},
		[P_INSTRUCTION_TARGET](char)
		{
			if (RE_WS.test(char))
			{
				instructionTarget = getMarked();
				markStart();
				phase = P_INSTRUCTION_BODY;
			}
		},
		[P_INSTRUCTION_BODY](char)
		{
			if (char === '?')
			{
				phase = P_INSTRUCTION_END;
				markEnd();
			}
		},
		[P_INSTRUCTION_END](char)
		{
			if (char === '>')
			{
				assertNotNull(instructionTarget);
				onInstruction(instructionTarget, getMarked(false));
				instructionTarget = null;
				phase = P_PCDATA;
			}
			else
			{
				phase = P_INSTRUCTION_BODY;
			}
		},
		[P_TAG_OPENING](char)
		{
			const previousPhase = phase;
			switch (char)
			{
				case '>':
					phase = P_PCDATA;
					break;

				case '/':
					phase = P_TAG_OPENING_SELF;
					break;
			}

			// main phase exit
			if ((phase & 240) !== P_TAG_OPENING)
			{
				switch (previousPhase)
				{
					case P_TAG_OPENING:
						onTagOpen(tagName = getMarked());
						break;

					case P_ATTR_NAME:
						onAttribute(getMarked(), null);
						break;

					case P_ATTR_SEEK_EQ:
						assertNotNull(attrName);
						onAttribute(attrName, null);
						break;

					case P_ATTR_SEEK_VALUE:
						onAttribute('', null);
						break;

					case P_ATTR_VALUE:
						assertNotNull(attrName);
						onAttribute(attrName, getMarked());
						break;
				}

				if (phase === P_PCDATA)
				{
					assertNotNull(tagName);
					onTagOpenEnd(tagName);
					tagName = null;
				}
				return;
			}

			// sub-phases
			switch (phase)
			{
				case P_TAG_OPENING:
					if (RE_WS.test(char))
					{
						onTagOpen(tagName = getMarked());
						phase = P_ATTR_SEEK_NAME;
					}
					break;

				case P_ATTR_SEEK_NAME:
					if (!RE_WS.test(char))
					{
						markStart(true);
						phase = P_ATTR_NAME;
					}
					break;

				case P_ATTR_NAME:
					if (char === '=')
					{
						phase = P_ATTR_SEEK_VALUE;
					}
					else if (RE_WS.test(char))
					{
						phase = P_ATTR_SEEK_EQ;
					}

					if (phase !== P_ATTR_NAME)
					{
						attrName = getMarked();
					}
					break;

				case P_ATTR_SEEK_EQ:
					if (char === '=')
					{
						phase = P_ATTR_SEEK_VALUE;
					}
					else if (!RE_WS.test(char))
					{
						assertNotNull(attrName);
						onAttribute(attrName, null);
						attrName = null;
						markStart(true);
						phase = P_ATTR_NAME;
					}
					break;

				case P_ATTR_SEEK_VALUE:
					if (!RE_WS.test(char))
					{
						if (RE_QUOTE.test(char))
						{
							markStart();
							quote = char;
							phase = P_TAG_ATTR_QUOTED;
						}
						else
						{
							markStart(true);
							phase = P_ATTR_VALUE;
						}
					}
					break;

				case P_ATTR_VALUE:
					if (RE_WS.test(char))
					{
						assertNotNull(attrName);
						onAttribute(attrName, getMarked());
						attrName = null;
						phase = P_ATTR_SEEK_NAME;
					}
					break;
			}
		},
		[P_TAG_ATTR_QUOTED](char)
		{
			switch (char)
			{
				case quote:
					assertNotNull(attrName);
					onAttribute(attrName, getMarked());
					attrName = null;
					phase = P_ATTR_SEEK_NAME;
					break;

				case '&':
					markEntityStart();
					break;

				case ';':
					markEntityEnd();
					break;
			}
		},
		[P_TAG_OPENING_SELF](char)
		{
			if (char === '>')
			{
				assertNotNull(tagName);
				onTagOpenEnd(tagName);
				onTagClose(tagName, true);
				tagName = null;
				phase = P_PCDATA;
			}
			else
			{
				phase = P_TAG_OPENING;
			}
		},
		[P_TAG_CLOSING_CANDIDATE](char)
		{
			if (RE_TAG_START.test(char))
			{
				phase = P_TAG_CLOSING;
			}
		},
		[P_TAG_CLOSING](char)
		{
			if (char === '>')
			{
				onTagClose(getMarked(), false);
				phase = P_PCDATA;
			}
			else if (RE_WS.test(char))
			{
				onTagClose(getMarked(), false);
				phase = P_TAG_CLOSING_END;
			}
		},
		[P_TAG_CLOSING_END](char)
		{
			if (char === '>')
			{
				phase = P_PCDATA;
			}
		}
	};
	/* eslint-enable */

	const write = (str: string) =>
	{
		current = str;
		for (index = 0; index < current.length; ++index)
		{
			const char = current[index];
			phases[phase & 240](char);
		}

		if (anchorStart === null)
		{
			buffer = '';
		}
		else if (anchorStart > 0)
		{
			assertNotNull(anchorEnd);

			buffer = current.slice(anchorStart);
			anchorEnd = Math.max(anchorEnd - anchorStart, 0);
			anchorStart = 0;
		}
		else
		{
			buffer += current;
		}

		current = '';
	};

	const end = () =>
	{
		current = '';
		index = 0;

		switch (phase)
		{
			case P_PCDATA:
				{
					markEnd();
					const text = getMarked();
					if (text)
					{
						onText(text);
					}
				}
				break;
		}

		current = '';
		buffer = '';
	};

	return { end, write };
}
