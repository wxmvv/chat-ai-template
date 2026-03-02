import './style.css';
import javascriptLogo from '/javascript.svg?url';
import vueLogo from '/vue.svg?url';
import reactLogo from '/react.svg?url';

document.querySelector('#app').innerHTML = `
  <div>
    <div id="vue-link" target="_blank">
      <img src="${vueLogo}" class="logo vue" alt="Vue logo" />
    </div>
    <!--
    <div id="vanilla-link" target="_blank">
      <img src="${javascriptLogo}" class="logo vanilla" alt="vanilla logo" />
    </div>
    <div id="react-link" target="_blank">
      <img src="${reactLogo}" class="logo react" alt="React logo" />
    </div>
    -->
  </div>
`;

const app = document.querySelector('#app');

// vue
const vueLink = document.querySelector('#vue-link');
const vue = document.querySelector('#vue-app');

vueLink.addEventListener('click', () => {
	initVue();
});

const initVue = () => {
	vue.style.display = 'flex';
	app.style.display = 'none';
};
