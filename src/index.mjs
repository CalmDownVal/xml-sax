import createParser from './parser.mjs';

function parse(str, options)
{
	const parser = createParser(options);
	parser.write(str);
	parser.end();
}

function parseStream(readable, options)
{
	return new Promise((resolve, reject) =>
	{
		const parser = createParser(options);

		const onError = error =>
		{
			readable.off('data', onData);
			readable.off('close', onEnd);
			reject(error);
		};

		const onData = chunk =>
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
				resolve(document);
			}
			catch (error)
			{
				onError(error);
			}
		};

		readable.setEncoding('utf8');
		readable.on('data', onData);
		readable.once('end', onEnd);
	});
}

export { createParser, parse, parseStream };
