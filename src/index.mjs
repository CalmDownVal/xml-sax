import createParser from './parser.mjs';

function parse(str, options)
{
	const parser = createParser(options);
	parser.write(str);
	parser.end();
}

function parseStream(stream, options)
{
	return new Promise((resolve, reject) =>
	{
		const parser = createParser(options);

		const onError = error =>
		{
			stream.off('data', onData);
			stream.off('close', onEnd);
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

		stream.setEncoding('utf8');
		stream.on('data', onData);
		stream.once('end', onEnd);
	});
}

export { createParser, parse, parseStream };
