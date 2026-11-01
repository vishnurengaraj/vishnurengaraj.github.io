const shell = { render: () => null };

export const routes = [
  { path: "/", name: "home", component: shell },
  { path: "/about", name: "about", component: shell },
  { path: "/projects", name: "projects", component: shell },
  { path: "/skills", redirect: (to) => ({ path: "/resume/skills", query: to.query }) },
  {
    path: "/resume/:tab(skills|experience|education|clubs|awards)?",
    name: "resume",
    component: shell,
  },
  { path: "/diners", name: "diners", component: shell },
  { path: "/:pathMatch(.*)*", redirect: "/" },
];
