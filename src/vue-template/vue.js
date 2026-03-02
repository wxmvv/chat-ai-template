import { createApp } from 'vue';
import chat from './chat.vue';

function initVue() {
	const app = createApp(chat);
	app.mount('#vue-app');
}

initVue();
