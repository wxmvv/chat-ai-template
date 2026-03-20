// 生成uuid
const UUID = () => {
	let str = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
	return str.replace(/[xy]/g, (c) => {
		let r = (Math.random() * 16) | 0,
			v = c == 'x' ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
};
// 使用日期生成id
const RandomId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

// 格式化时间
const formatTime = (t) => {
	if (!t) return '-';
	return new Date(t).toLocaleString();
};

// 下载json
const downloadJSON = (fileName, json) => {
	const blob = new Blob([json], { type: 'application/json' });
	const url = URL.createObjectURL(blob);

	const a = document.createElement('a');

	a.href = url;
	a.download = fileName;

	a.click();
	URL.revokeObjectURL(url);
};

// 导入文件
const importFile = (onLoad, accept = '.json,application/json') => {
	if (typeof document === 'undefined') {
		throw new Error('File import is only available in browser environments.');
	}

	const input = document.createElement('input');
	input.type = 'file';
	input.accept = accept;

	input.onchange = (event) => {
		const file = event.target?.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			onLoad?.(e.target?.result || '');
		};
		reader.readAsText(file);
	};

	input.click();
};

export { UUID, RandomId, formatTime, downloadJSON, importFile };
