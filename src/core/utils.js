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

const importFile = (file) => {
	const reader = new FileReader();

	reader.onload = (e) => {
		importConversation(e.target.result);
	};

	reader.readAsText(file);
};

export { UUID, RandomId, formatTime, downloadJSON, importFile };
