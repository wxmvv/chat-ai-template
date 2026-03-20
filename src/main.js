import './style.css';
import javascriptLogo from '/javascript.svg?url';
import vueLogo from '/vue.svg?url';
import reactLogo from '/react.svg?url';

// vue
import { createApp } from 'vue';
import VueChat from './vue-template/chat.vue';

function initVue() {
	const app = createApp(VueChat);
	app.mount('#vue-app');
}

// react
import React from 'react';
import { createRoot } from 'react-dom/client';
import ReactChat from './react-template/chat.jsx';

function initReact() {
	createRoot(document.querySelector('#react-app')).render(React.createElement(ReactChat));
}

document.querySelector('#app').innerHTML = `
  <div>
    <div id="vue-link" target="_blank">
      <img src="${vueLogo}" class="logo vue" alt="Vue logo" />
    </div>
    <!--
    <div id="vanilla-link" target="_blank">
      <img src="${javascriptLogo}" class="logo vanilla" alt="vanilla logo" />
    </div>
    -->
    <div id="react-link" target="_blank">
      <img src="${reactLogo}" class="logo react" alt="React logo" />
    </div>
  </div>
`;

const app = document.querySelector('#app');

// vue
const vueLink = document.querySelector('#vue-link');
const reactLink = document.querySelector('#react-link');

const vue = document.querySelector('#vue-app');
const react = document.querySelector('#react-app');

vueLink.addEventListener('click', () => {
	showVuePage();
});

reactLink.addEventListener('click', () => {
	showReactPage();
});

const showVuePage = () => {
	vue.style.display = 'flex';
	app.style.display = 'none';
	initVue();
};

const showReactPage = () => {
	react.style.display = 'flex';
	app.style.display = 'none';
	initReact();
};
