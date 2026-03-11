import { createRouter, createWebHashHistory } from "vue-router";

import ActivityPage from "./pages/ActivityPage.vue";
import CapabilitiesPage from "./pages/CapabilitiesPage.vue";
import ChatPage from "./pages/ChatPage.vue";
import DevicesPage from "./pages/DevicesPage.vue";
import HomePage from "./pages/HomePage.vue";
import LogsPage from "./pages/LogsPage.vue";
import OpenClawPage from "./pages/OpenClawPage.vue";
import PermissionsPage from "./pages/PermissionsPage.vue";
import ProcessesPage from "./pages/ProcessesPage.vue";
import SessionsPage from "./pages/SessionsPage.vue";
import SettingsPage from "./pages/SettingsPage.vue";
import TasksPage from "./pages/TasksPage.vue";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: "/",
      component: HomePage
    },
    {
      path: "/chat",
      component: ChatPage
    },
    {
      path: "/activity",
      component: ActivityPage
    },
    {
      path: "/capabilities",
      component: CapabilitiesPage
    },
    {
      path: "/permissions",
      component: PermissionsPage
    },
    {
      path: "/openclaw",
      component: OpenClawPage
    },
    {
      path: "/sessions",
      component: SessionsPage
    },
    {
      path: "/devices",
      component: DevicesPage
    },
    {
      path: "/tasks",
      component: TasksPage
    },
    {
      path: "/processes",
      component: ProcessesPage
    },
    {
      path: "/settings",
      component: SettingsPage
    },
    {
      path: "/logs",
      component: LogsPage
    }
  ]
});
