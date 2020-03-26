import { createParser, IParser, IParserOptions } from './parser';
export { createParser, IParser, IParserOptions };

export function parse(str: string, options: IParserOptions)
{
	const parser = createParser(options);
	parser.write(str);
	parser.end();
}

export function parseStream(readable: NodeJS.ReadableStream, options: IParserOptions)
{
	return new Promise<void>((resolve, reject) =>
	{
		const parser = createParser(options);
		const onError = (error: Error) =>
		{
			/* eslint-disable @typescript-eslint/no-use-before-define */
			readable
				.off('data', onData)
				.off('close', onEnd);
			/* eslint-enable */
			reject(error);
		};

		const onData = (chunk: string) =>
		{
			try
			{
				parser.write(chunk);
			}
			catch (error)
			{
				onError(error);
			}
		};

		const onEnd = () =>
		{
			try
			{
				parser.end();
				resolve();
			}
			catch (error)
			{
				onError(error);
			}
		};

		readable
			.setEncoding('utf8')
			.on('data', onData)
			.on('end', onEnd);
	});
}
