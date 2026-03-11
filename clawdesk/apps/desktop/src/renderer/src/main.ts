import { createApp } from "vue";

import App from "./App.vue";
import { router } from "./router";
import "./styles.css";
import { initializeUiPreferences } from "./services/ui-preferences";

initializeUiPreferences();
createApp(App).use(router).mount("#app");
