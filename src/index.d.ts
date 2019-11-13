export declare interface IParserOptions
{
	entities?: { [key: string]: string };
	onAttribute: (name: string, value?: string) => void;
	onCData: (data: string) => void;
	onComment: (data: string) => void;
	onDeclaration: (body: string, comment?: string) => void;
	onInstruction: (target: string, body: string) => void;
	onTagClose: (name: string, isSelfClosing: boolean) => void;
	onTagOpen: (name: string) => void;
	onTagOpenEnd: (name: string) => void;
	onText: (text: string) => void;
}

export declare interface IParser
{
	write: (chunk: string) => void;
	end: () => void;
}

export declare function createParser(options: IParserOptions): IParser;
export declare function parse(str: string, options: IParserOptions): void;
export declare function parseStream(readable: ReadableStream, options: IParserOptions): Promise<void>;
