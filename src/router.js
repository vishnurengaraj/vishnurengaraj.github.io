const shell = { render: () => null };

export const routes = [
  { path: "/", name: "home", component: shell },
  { path: "/about", name: "about", component: shell },
  { path: "/projects", name: "projects", component: shell },
  { path: "/skills", name: "skills", component: shell },
  {
    path: "/resume/:tab(experience|education|clubs|awards)?",
    name: "resume",
    component: shell,
  },
  { path: "/:pathMatch(.*)*", redirect: "/" },
];
