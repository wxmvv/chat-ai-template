// 生成uuid
export const UUID = () => {
	let str = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
	return str.replace(/[xy]/g, (c) => {
		let r = (Math.random() * 16) | 0,
			v = c == 'x' ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
};
// 使用日期生成id
export const RandomId = () =>
	Date.now().toString() + Math.random().toString(36).substr(2, 9);
