import media from "./media.json";

/**
 * Site copy.
 *
 * Professional facts prefer the February 2023 resume
 * (public/assets/vishnu_rengaraj_resume.pdf, committed 2023-02-04).
 * Older portfolio items the resume simply omits (Tesla, Altair, Iroquois,
 * Oakland, high school, clubs detail, awards, the three projects) are kept.
 *
 * Contact email: the 2023 resume lists vishnurengaraj2287@gmail.com.
 * The 2021 site used vrenga@umich.edu. The Gmail address is linked because
 * it is the newer one — confirm before switching.
 *
 * Resume typos corrected in prose (facts unchanged): "fight software" →
 * "flight software", "gradient decent" → "gradient descent",
 * "for to meet" → "to meet", "by conducted" → "by conducting",
 * project subtitle "vehcile" → "vehicle".
 */

export const profile = {
  email: "vishnurengaraj2287@gmail.com",
  linkedin: "https://www.linkedin.com/in/vishnu-rengaraj/",
  resume: "/assets/vishnu_rengaraj_resume.pdf",
  location: "Hawthorne, California",
  roles: [
    "Mechanical Engineer",
    "Computer Scientist",
    "Development Test Engineer",
    "Test Engineer at SpaceX",
    "Designer",
    "Stress Analyst",
    "Runner",
    "Backpacker",
    "Banana Lover",
  ],
};

export const bio = [
  { text: "Hey there! My name is " },
  { text: "Vishnu Rengaraj", strong: true },
  { text: ". I'm a " },
  { text: "Sr. Development Test Engineer", strong: true },
  { text: " at " },
  { text: "SpaceX", strong: true },
  {
    text: " in Hawthorne, California, where I design novel test equipment for quick and accurate aerospace qualification. I completed an ",
  },
  { text: "M.S.E. in Mechanical Engineering", strong: true },
  { text: " at the " },
  { text: "University of Michigan", strong: true },
  { text: " (computational mechanics) and a " },
  { text: "B.S.E. in Mechanical Engineering", strong: true },
  {
    text: " with a minor in computer science. Here are some recent milestones:",
  },
];

export const timeline = [
  {
    datetime: "2020-06",
    date: "June 2020",
    title: "SpaceX — Test Development",
    category: "Full time",
    tone: "work",
    description:
      "Sr. Development Test Engineer. Design novel test equipment for quick and accurate aerospace qualification.",
  },
  {
    datetime: "2020-09",
    date: "September 2020",
    title: "University of Michigan",
    category: "Graduate school",
    tone: "school",
    description:
      "M.S.E. in Mechanical Engineering with an emphasis in computational mechanics. Completed April 2021.",
  },
  {
    datetime: "2019-05",
    date: "May 2019",
    title: "Tesla — Body Design",
    category: "Internship",
    tone: "intern",
    description:
      "Design, validate, and manage structural body components through their lifecycle",
  },
  {
    datetime: "2016-09",
    date: "September 2016",
    title: "University of Michigan",
    category: "Undergraduate school",
    tone: "school",
    description:
      "B.S.E. in Mechanical Engineering with a minor in Computer Science",
  },
];

/**
 * Portfolio projects, rendered from this list.
 * Prepend a SpaceX-era project with era: "spacex" when there is a real one
 * to publish. Era headings appear only after a second era has items.
 * Shape: { era, title, subtitle, body, image, imageAlt, button, href }.
 * image comes from src/data/media.json. href and image may be omitted.
 */
export const projectGroups = [
  { id: "spacex", label: "SpaceX" },
  { id: "earlier", label: "Earlier work" },
];

export const projects = [
  {
    era: "earlier",
    title: "Audio Upscaling with Deep Learning",
    subtitle:
      "Frequency fused residual convolutional network to resolve high frequency data",
    image: media.img.audio,
    imageAlt:
      "Spectrogram results of our model output as well as the low res input and high res goal",
    body: "With the continued growth of videoconferencing it is imperative that sound quality is maintained regardless of microphone quality. This work focuses on upscaling low resolution audio using deep learning to solve this problem. We have successfully implemented a novel frequency residual neural network that increases the frequency range of low sample-rate audio clips as well as tested the effectiveness of generative adversarial networks and other low quality data forms on the upscaling process.",
    button: "Paper",
    href: "/assets/Audio_Upscaling.pdf",
  },
  {
    era: "earlier",
    title: "Solving Boundary Value Problems with Machine Learning",
    subtitle:
      "Real-time finite element analysis prediction with convolutional neural network",
    image: media.img.fea,
    imageAlt:
      "Actual and predicted displacement contours in X and Y directions from given forcing",
    body: "Boundary value problems have been classically solved using finite element analysis (FEA). Although thoroughly proven, FEA is inherently computationally expensive with large models as inverting the stiffness matrix, a critical step in FEA, is costly. This results in complex analysis taking hours or days to solve even on powerful hardware. I propose a study to seek the viability of merging machine learning techniques with FEA in order to get results quicker. I have proven that it is possible to achieve quality results, with some loss of detail, quickly on a sparse dataset. This suggests that deep learning can be used to enhance the FEA workflow by providing estimations of results. I am hesitant to say that deep learning will replace FEA as there is never a guarantee you are getting an accurate result and the trained model is a black box that you can’t diagnose in the event something goes wrong.",
    button: "Presentation",
    href: "/assets/FEA_CNN.pdf",
  },
  {
    era: "earlier",
    title: "Baja SAE Full Vehicle Crash Simulation",
    subtitle:
      "Explicit finite element simulation via RADIOSS of a Baja vehicle under different crashing scenarios",
    image: media.img.bajaCrash,
    imageAlt: "Frontal impact crash simulation in RADIOSS",
    body: "Analysis conducted on a full-frame finite element model to assess torsional stiffness was validated through torsional stiffness tests conducted on the completed frame post-completion. Our simulation results were proven to be very accurate, having only 2% error. One concern with the switch to a rear braced frame was the frame integrity in crashes and rollover situations. Crashing the frame to validate this performance is not an option, as we lack the production capability to produce a spare frame. However, through using explicit analysis, we were able to assess the performance of the frame in a variety of impact situations including front crash, side crash, and rollover. These simulation results were validated using three-point bend tests on frame tubes, proving the analysis is accurate with 6% error.",
    button: "Article",
    href: "/assets/Baja_Article.pdf",
  },
];

export const skills = [
  "HyperWorks",
  "Ansys",
  "OptiStruct",
  "RADIOSS",
  "Nastran",
  "Abaqus",
  "LS-DYNA",
  "GD&T (FT&A)",
  "Siemens NX",
  "CATIA V5",
  "CNC Mill",
  "CNC Lathe",
  "C",
  "C++",
  "Python",
  "MATLAB",
  "PyTorch",
  "TensorFlow",
  "NumPy",
  "OpenCV",
  "SciPy",
];

export const experience = [
  {
    title: "SpaceX",
    date: "June 2020 – Present",
    subtitle: "Sr. Development Test Engineer · Hawthorne, California",
    about:
      "SpaceX designs, manufactures and launches advanced rockets and spacecraft. The company was founded in 2002 to revolutionize space technology, with the ultimate goal of enabling people to live on other planets.",
    link: "https://www.spacex.com/",
    media: [{ kind: "logo", image: media.img.spacex, alt: "SpaceX logo" }],
    bullets: [
      {
        strong: true,
        text: "Design novel test equipment for quick and accurate aerospace qualification",
        children: [
          {
            strong: true,
            text: "Satellite Deployment Mechanism Qualification",
            children: [
              "Built custom DAQ and control computer to run flight software directly on hardware: Linux machine running Python automation via NI cards and relay boards",
              "Qualified full suite of systems: pneumatics, structures, mechanisms, electronics, and software",
              "Identified design issues such as excessive current draw from chain tension, incorrect transition in flight software, inaccuracy in potentiometer telemetry, piston stick-slip conditions, and more",
            ],
          },
          {
            strong: true,
            text: "Fueling Quick Disconnect (QD) Misalignment Testing",
            children: [
              "Designed fixture with 6 DoF Stewart platform to induce any arbitrary angular and translational offsets between mating QDs to test alignment capabilities",
              "Wrote custom automation for test stand in flight control code: platform inverse kinematics, hydraulic servo control, gradient descent force control, and safety aborts",
            ],
          },
          {
            strong: true,
            text: "Elliptical Dome Burst Test",
            children: [
              "Filled test tank with 500,000L of LN2 and pressurized tank with GN2 until rupture to validate, and correlate, failure mode and region",
              "Coordinated with civil, GSE, legal, telecom/IT, and analysis departments to conduct test as a pathfinder for new test facility",
            ],
          },
          {
            strong: true,
            text: "FAA Bird Strike Testing (Internship)",
            children: [
              {
                text: "Designed, manufactured, and tested 25 ft. long high pressure gas cannon for antenna bird impact testing",
                children: [
                  "Created detailed fluids physics model in Python based on flow fundamentals",
                  "Generated drawings (GD&T) + fluid schematics and worked with suppliers to manufacture cannon",
                  "Coordinated assembly of fluid system, DAQ, projectiles, and other critical infrastructure",
                ],
              },
              "Ran LS-DYNA explicit bird impact analysis to assess test fixture boundary conditions, and scripted automation to run simulations at different angles and velocities",
              "Designed and analyzed actuator assemblies on short timeline for critical path parts",
              "Documented and researched environmental testing and sorted conditions on importance",
            ],
          },
        ],
      },
    ],
  },
  {
    title: "Tesla",
    date: "2019",
    subtitle: "Body Design Intern",
    about:
      "Tesla was founded in 2003 by a group of engineers who wanted to prove that people didn’t need to compromise to drive electric – that electric vehicles can be better, quicker and more fun to drive than gasoline cars. Today, Tesla builds not only all-electric vehicles but also infinitely scalable clean energy generation and storage products. Tesla believes the faster the world stops relying on fossil fuels and moves towards a zero-emission future, the better..",
    link: "https://www.tesla.com/",
    media: [
      { kind: "logo", image: media.img.tesla, alt: "Tesla logo" },
    ],
    after: [
      {
        kind: "photo",
        image: media.img.teslaExtra,
        alt: "Model 3 body structure",
      },
    ],
    bullets: [
      {
        strong: true,
        text: "Design, validate, and manage structural body components through their lifecycle",
        children: [
          "Implemented part reduction measures on Model S estimated to save $30,000 yearly",
          "Introduced Model 3 rear tow solution to meet deflection, homologation, crash, and fascia requirements",
          "Redesigned rear crash structure on Model 3 to meet durability life requirements while maintaining manufacturability",
          "Supported Model Y launch by implementing manufacturing changes and developing FT&A (GD&T) for body components with tight timelines",
        ],
      },
    ],
  },
  {
    title: "Altair",
    date: "2018",
    subtitle: "Modeling/Visualization Intern",
    about:
      "Altair is a leading provider of enterprise-class engineering software enabling innovation, reduced development times, and lower costs through the entire product lifecycle from concept design to in-service operation.",
    link: "https://www.altair.com/",
    media: [{ kind: "logo", image: media.img.altair, alt: "Altair logo" }],
    after: [
      {
        kind: "video",
        ...media.video.altair,
        alt: "Dynamic crash simulation result",
      },
    ],
    bullets: [
      {
        strong: true,
        text: "Coding engineering software to tailor it to customer’s (GM, Apple, Google etc.) needs",
        children: [
          "Developed software packages for customers to automate repetitive tasks and interface with data files",
          "Optimized sorting algorithms for lower runtimes; reduced automatic file creation runtime by 8x",
          "Generated responsive GUIs for user input and output",
        ],
      },
      "Conducted linear and nonlinear finite element analysis to identify viability of customer’s design",
      "Contributed to development of Internet of Things (IoT) project which will be brought to trade shows",
    ],
  },
  {
    title: "Iroquois Industries",
    date: "2017",
    subtitle: "Computer Aided Engineering Intern",
    about:
      "Iroquois Industries Inc. is a multidisciplinary company with the capability to design, validate, prototype and manufacture fully functional metal components and welded assemblies across four commodities: General Stampings, Chassis, Powertrain and Suspension.",
    link: "https://www.iroquoisind.com/",
    media: [
      {
        kind: "photo",
        image: media.img.iroqouis,
        alt: "Stamped parts Iroquois Industries makes",
      },
    ],
    after: [
      {
        kind: "video",
        ...media.video.iroqouis,
        alt: "Car front corner suspension",
      },
    ],
    bullets: [
      {
        strong: true,
        text: "Analysis and optimization of spring links, trailing arms, and other suspension parts",
        children: [
          "Analyzed suspension components to validate structural integrity in various virtual testing scenarios",
          "Optimized suspension components resulting in mass reduction of more than 300 grams (8% mass reduction)",
          "Modified designs for smaller blank sizes and easier manufacturability resulting in cheaper product",
          "Validated parts with real-world Instron testing for max loading and hydraulic fixtures for fatigue loading",
        ],
      },
    ],
  },
];

export const education = [
  {
    title: "University of Michigan, Ann Arbor",
    date: "September 2020 – April 2021",
    subtitle: "M.S.E. Mechanical Engineering · Focus: Computational Mechanics",
    gpa: "4.00/4.00",
    image: media.img.umichGrad,
    imageAlt: "University of Michigan graduate campus",
    link: "https://masters.engin.umich.edu/degree/mechanical-engineering-mse/",
    linkLabel: "Website",
  },
  {
    title: "University of Michigan, Ann Arbor",
    date: "September 2016 – April 2020",
    subtitle: "B.S.E. Mechanical Engineering · Minor: Computer Science",
    gpa: "3.83/4.00",
    image: media.img.umichUndergrad,
    imageAlt: "University of Michigan stadium",
    link: "https://www.engin.umich.edu/",
    linkLabel: "Website",
  },
];

export const coursework =
  "Fracture Mechanics · Continuum Mechanics · Finite Element Method · Behaviors of Materials · Controls · Dynamics · Statics · Fluids · Heat Transfer · Thermodynamics · Machine Learning · Computer Vision · Data Structures and Algorithms · Robotics Lab (SLAM + Kinematics)";

export const earlierEducation = [
  {
    title: "Oakland University",
    date: "2015–2016",
    subtitle: "Mathematics, during high school",
    gpa: "3.87",
    image: media.img.oakland,
    imageAlt: "Oakland University",
    link: "https://oakland.edu/",
    linkLabel: "Website",
  },
  {
    title: "Rochester Adams Highschool",
    date: "2012–2016",
    subtitle: "",
    gpa: "4.23 (weighted)",
    link: "https://ahs.rochester.k12.mi.us/",
    linkLabel: "Website",
  },
];

export const clubs = [
  {
    title: "Michigan Baja Racing",
    date: "September 2016 – May 2020",
    subtitle:
      "Testing & Validation Director, Suspension and Chassis Lead (2017–2020)",
    about:
      "Michigan Baja is a student engineering team tasked with designing, building, and testing a single seater off-road vehicle to compete against other collegiate teams. We routinely place in the top 3 at every competition due to our commitment to a lightweight, durable design.",
    aboutLabel: "About the club",
    link: "https://www.michiganbajaracing.com/",
    media: [
      {
        kind: "photo",
        image: media.img.baja,
        alt: "2019 Michigan Baja SAE car",
      },
    ],
    bullets: [
      {
        strong: true,
        text: "Testing and validation",
        children: [
          "Collected testing data via strain gauges, Hall effect sensors, potentiometers, and accelerometers",
          "Implemented implicit linear static and non-linear quasi-static simulations for stiffness and strain calculations",
          "Developed scripts to automate material, property, and loadcase definitions w/ one-click tetra-meshing",
          "Introduced topology optimization reducing transmission rotational inertia by 30% and overall weight by ~8lbs",
          "Applied high performance computing (HPC) to decrease turnaround time by 10x",
        ],
      },
      {
        strong: true,
        text: "Suspension",
        children: [
          "Redesigned front lower control arm (FLCA) to reduce part count from 8 -> 5, reduce weight by 0.5lb per link, and increase impact toughness",
          "Improved rear upper link (H-Arm) durability by collecting rear suspension loads and applying them to a topology optimization to solve for abuse loading while minimizing mass",
        ],
      },
      {
        strong: true,
        text: "Chassis",
        children: [
          "Simulated full vehicle crash with optimization via RADIOSS and OptiStruct to design safer roll cage",
          "Validated simulations by conducting Instron testing and correlating results to simulations",
          "Verified torsional stiffness with static analysis and then real-world deflection tests",
        ],
      },
      "Mill, Lathe, and CNC Mill certified",
    ],
  },
  {
    title: "FIRST Robotics",
    date: "2012–2016",
    subtitle: "Team Captain · Mechanical Lead · Fabrication Lead",
    about:
      'Under strict rules, limited resources, and an intense six-week time limit, teams of students are challenged to raise funds, design a team "brand," hone teamwork skills, and build and program industrial-size robots to play a difficult field game against like-minded competitors.',
    aboutLabel: "About the club",
    link: "https://www.adambots.com/",
    media: [
      { kind: "photo", image: media.img.robotics, alt: "2016 Adambots robot" },
    ],
    prose: [
      "I've been a part of first robotics since 4th grade and had a passion for it ever since. I joined the Adambots, team 245, in 9th grade and continued all through my high school years. As I gained experience, I moved up in the team starting as a general member then to a team lead and finally to team captain. Additionally, I was the primary driver of the robot for three years which exposed me to other teams and engineers from other states and countries.",
      "A specific component I am proud of is the catapult I designed my senior year. The challenge was to shoot a dodgeball into a small opening in a tower. Most of other teams used a flywheel shooter which was only accurate at close ranges. My catapult could shoot at any fixed range and ultimately was the key to winning the Cincinnati regional competition.",
    ],
  },
];

export const awards = [
  {
    title: "R&B Machine Tool Company Scholarship",
    date: "2020",
    link: "https://me.engin.umich.edu/news-events/news/me-students-receive-me-departmental-awards-0",
  },
  {
    title: "Ford Vehicle Design Team Scholarship",
    date: "2017, 2018",
    link: "https://www.fordfund.org/education",
  },
  {
    title: "FCA Student Achievement Scholarship",
    date: "2017",
  },
  {
    title: "William J. Branstrom Freshman Prize",
    subtitle: "Top 5% of first-year students",
    date: "2017",
    link: "https://umich-regoff.custhelp.com/app/answers/detail/a_id/1303/~/william-j.-branstrom-freshman-prize-criteria",
  },
  {
    title: "James B. Angell Scholar",
    subtitle: "Consecutive semesters of only A’s",
    date: "2018",
    link: "https://webapps.lsa.umich.edu/academicsrequirements2013/honorsawards/universityhonors/angellscholars/index.html",
  },
  {
    title: "University of Michigan Honors & Dean's List",
    date: "2016–2018",
    link: "https://studentawards.engin.umich.edu/deanslist/",
  },
  {
    title: "FIRST Robotics Dean’s List Finalist",
    date: "2015",
  },
];
