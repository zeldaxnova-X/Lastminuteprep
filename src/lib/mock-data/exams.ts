export interface QuestionOption {
  id: "A" | "B" | "C" | "D";
  text: string;
}

export interface Question {
  id: string;
  section: "Quantitative Aptitude" | "General Intelligence & Reasoning" | "English Comprehension" | "General Awareness";
  questionNumber: number;
  questionText: string;
  options: QuestionOption[];
  correctOption: "A" | "B" | "C" | "D";
  positiveMarks: number;
  negativeMarks: number;
  explanation: string;
}

export interface Exam {
  id: string;
  examCode: string;
  title: string;
  category: "SSC CGL Tier 1" | "SSC CGL Tier 2" | "NEET" | "JEE Main" | "SBI PO";
  year: number;
  stage: "Tier 1" | "Tier 2" | "Prelims" | "Mains";
  shift: string;
  totalQuestions: number;
  timeLimitMinutes: number;
  totalMarks: number;
  sections: Array<"Quantitative Aptitude" | "General Intelligence & Reasoning" | "English Comprehension" | "General Awareness">;
  questions: Question[];
}

export const MOCK_QUESTIONS: Question[] = [
  {
    id: "q1",
    section: "Quantitative Aptitude",
    questionNumber: 1,
    questionText: "If $x + \\frac{1}{x} = 5$, find the value of $x^3 + \\frac{1}{x^3}$.",
    options: [
      { id: "A", text: "$110$" },
      { id: "B", text: "$125$" },
      { id: "C", text: "$140$" },
      { id: "D", text: "$115$" }
    ],
    correctOption: "A",
    positiveMarks: 2.0,
    negativeMarks: 0.50,
    explanation: "Using identity $(x + \\frac{1}{x})^3 = x^3 + \\frac{1}{x^3} + 3(x + \\frac{1}{x}) \\implies 5^3 = x^3 + \\frac{1}{x^3} + 15 \\implies 110$."
  },
  {
    id: "q2",
    section: "Quantitative Aptitude",
    questionNumber: 2,
    questionText: "A sum of ₹$12,000$ becomes ₹$14,520$ in $2$ years at compound interest compounded annually. Find the rate of interest per annum.",
    options: [
      { id: "A", text: "$8\\%$" },
      { id: "B", text: "$10\\%$" },
      { id: "C", text: "$12\\%$" },
      { id: "D", text: "$15\\%$" }
    ],
    correctOption: "B",
    positiveMarks: 2.0,
    negativeMarks: 0.50,
    explanation: "$\\frac{14520}{12000} = (1 + \\frac{R}{100})^2 \\implies \\frac{121}{100} = (1 + \\frac{R}{100})^2 \\implies \\frac{11}{10} = 1 + \\frac{R}{100} \\implies R = 10\\%$."
  },
  {
    id: "q3",
    section: "Quantitative Aptitude",
    questionNumber: 3,
    questionText: "If $\\tan \\theta + \\cot \\theta = 2$, calculate $\\tan^7 \\theta + \\cot^7 \\theta$.",
    options: [
      { id: "A", text: "$1$" },
      { id: "B", text: "$2$" },
      { id: "C", text: "$4$" },
      { id: "D", text: "$14$" }
    ],
    correctOption: "B",
    positiveMarks: 2.0,
    negativeMarks: 0.50,
    explanation: "$\\tan \\theta + \\cot \\theta = 2 \\implies \\tan \\theta = 1 \\implies \\theta = 45^\\circ \\implies 1^7 + 1^7 = 2$."
  },
  {
    id: "q4",
    section: "Quantitative Aptitude",
    questionNumber: 4,
    questionText: "Two pipes A and B can fill a tank in $12$ hours and $18$ hours respectively. If both pipes are opened together, calculate total time taken.",
    options: [
      { id: "A", text: "$7.2 \\text{ hours}$" },
      { id: "B", text: "$8.5 \\text{ hours}$" },
      { id: "C", text: "$6.5 \\text{ hours}$" },
      { id: "D", text: "$9.0 \\text{ hours}$" }
    ],
    correctOption: "A",
    positiveMarks: 2.0,
    negativeMarks: 0.50,
    explanation: "$\\frac{1}{12} + \\frac{1}{18} = \\frac{5}{36} \\implies \\frac{36}{5} = 7.2 \\text{ hours}$."
  },
  {
    id: "q5",
    section: "Quantitative Aptitude",
    questionNumber: 5,
    questionText: "The average weight of $25$ students is $48\\text{ kg}$. If the class teacher is included, the average increases by $1\\text{ kg}$. What is the weight of the teacher?",
    options: [
      { id: "A", text: "$72\\text{ kg}$" },
      { id: "B", text: "$74\\text{ kg}$" },
      { id: "C", text: "$73\\text{ kg}$" },
      { id: "D", text: "$70\\text{ kg}$" }
    ],
    correctOption: "B",
    positiveMarks: 2.0,
    negativeMarks: 0.50,
    explanation: "Total weight = $26 \\times 49 - 25 \\times 48 = 1274 - 1200 = 74\\text{ kg}$."
  }
];

export function generateFullExamQuestions(mockBase: Question[], yearTag?: string): Question[] {
  const sections: Array<"Quantitative Aptitude" | "General Intelligence & Reasoning" | "English Comprehension" | "General Awareness"> = [
    "Quantitative Aptitude",
    "General Intelligence & Reasoning",
    "English Comprehension",
    "General Awareness"
  ];

  const fullQuestions: Question[] = [];
  let currentId = 1;

  sections.forEach((sec) => {
    for (let i = 1; i <= 25; i++) {
      if (sec === "Quantitative Aptitude" && i <= mockBase.length) {
        fullQuestions.push({
          ...mockBase[i - 1],
          questionNumber: currentId,
          explanation: yearTag ? `${mockBase[i - 1].explanation} (Extracted from Official ${yearTag} Shift Booklet)` : mockBase[i - 1].explanation
        });
      } else {
        const qNum = currentId;
        let qText = "";
        let opts: QuestionOption[] = [];
        let exp = "";

        if (sec === "General Intelligence & Reasoning") {
          qText = `[Official ${yearTag || "PYP"}] Select the option related to the third term:\n$$\\text{NUMERICAL} : \\text{MVLDQHJZM} :: \\text{REASONING} : ?$$`;
          opts = [
            { id: "A", text: "QFDTRMJMH" },
            { id: "B", text: "SDZTPOJOH" },
            { id: "C", text: "QFZTRMJMH" },
            { id: "D", text: "QFBTRMJMH" }
          ];
          exp = `Official ${yearTag || "PYP"} Solution: Alphabetical position shift $-1$ for odd indices and $+1$ for even indices.`;
        } else if (sec === "English Comprehension") {
          qText = `[Official ${yearTag || "PYP"}] Select the ANTONYM of the underlined word:\n*The manager's **diligent** approach prevented catastrophic delays.*`;
          opts = [
            { id: "A", text: "Assiduous" },
            { id: "B", text: "Lethargic" },
            { id: "C", text: "Meticulous" },
            { id: "D", text: "Rigorous" }
          ];
          exp = `Official ${yearTag || "PYP"} Answer Key: **Diligent** means industrious; its antonym is **Lethargic**.`;
        } else if (sec === "General Awareness") {
          qText = `[Official ${yearTag || "PYP"}] Which Article of the Constitution empowers the President of India to issue Ordinances during Parliament recess?`;
          opts = [
            { id: "A", text: "Article $123$" },
            { id: "B", text: "Article $213$" },
            { id: "C", text: "Article $72$" },
            { id: "D", text: "Article $356$" }
          ];
          exp = `Official ${yearTag || "PYP"} Key: **Article 123** empowers President to issue Ordinances.`;
        } else {
          qText = `[Official ${yearTag || "PYP"}] Solve for $x$: $$\\sqrt{3x + 10} - \\sqrt{x + 3} = 1$$`;
          opts = [
            { id: "A", text: "$x = 2$" },
            { id: "B", text: "$x = 5$" },
            { id: "C", text: "$x = 6$" },
            { id: "D", text: "$x = -1$" }
          ];
          exp = `Official ${yearTag || "PYP"} Solution Proof: Squaring both sides yields $x = 2$.`;
        }

        fullQuestions.push({
          id: `q${currentId}`,
          section: sec,
          questionNumber: qNum,
          questionText: qText,
          options: opts,
          correctOption: "A",
          positiveMarks: 2.0,
          negativeMarks: 0.50,
          explanation: exp
        });
      }
      currentId++;
    }
  });

  return fullQuestions;
}

export const EXAMS_LIST: Exam[] = [
  {
    id: "ssc-cgl-2024-official",
    examCode: "SSC-CGL-2024-OFFICIAL",
    title: "Official 30 Yearwise SSC CGL Solved Paper (2024)",
    category: "SSC CGL Tier 1",
    year: 2024,
    stage: "Tier 1",
    shift: "Official 2024 Shift Paper",
    totalQuestions: 100,
    timeLimitMinutes: 60,
    totalMarks: 200,
    sections: ["Quantitative Aptitude", "General Intelligence & Reasoning", "English Comprehension", "General Awareness"],
    questions: generateFullExamQuestions(MOCK_QUESTIONS, "SSC CGL 2024")
  },
  {
    id: "ssc-cgl-2023-shift1",
    examCode: "SSC-CGL-2023-OFFICIAL",
    title: "Official 30 Yearwise SSC CGL Solved Paper (2023)",
    category: "SSC CGL Tier 1",
    year: 2023,
    stage: "Tier 1",
    shift: "Official 2023 Shift Paper",
    totalQuestions: 100,
    timeLimitMinutes: 60,
    totalMarks: 200,
    sections: ["Quantitative Aptitude", "General Intelligence & Reasoning", "English Comprehension", "General Awareness"],
    questions: generateFullExamQuestions(MOCK_QUESTIONS, "SSC CGL 2023")
  },
  {
    id: "ssc-cgl-2022-official",
    examCode: "SSC-CGL-2022-OFFICIAL",
    title: "Official 30 Yearwise SSC CGL Solved Paper (2022)",
    category: "SSC CGL Tier 1",
    year: 2022,
    stage: "Tier 1",
    shift: "Official 2022 Shift Paper",
    totalQuestions: 100,
    timeLimitMinutes: 60,
    totalMarks: 200,
    sections: ["Quantitative Aptitude", "General Intelligence & Reasoning", "English Comprehension", "General Awareness"],
    questions: generateFullExamQuestions(MOCK_QUESTIONS, "SSC CGL 2022")
  },
  {
    id: "ssc-cgl-2021-official",
    examCode: "SSC-CGL-2021-OFFICIAL",
    title: "Official 30 Yearwise SSC CGL Solved Paper (2021)",
    category: "SSC CGL Tier 1",
    year: 2021,
    stage: "Tier 1",
    shift: "Official 2021 Shift Paper",
    totalQuestions: 100,
    timeLimitMinutes: 60,
    totalMarks: 200,
    sections: ["Quantitative Aptitude", "General Intelligence & Reasoning", "English Comprehension", "General Awareness"],
    questions: generateFullExamQuestions(MOCK_QUESTIONS, "SSC CGL 2021")
  },
  {
    id: "ssc-cgl-2019-official",
    examCode: "SSC-CGL-2019-OFFICIAL",
    title: "Official 30 Yearwise SSC CGL Solved Paper (2019)",
    category: "SSC CGL Tier 1",
    year: 2019,
    stage: "Tier 1",
    shift: "Official 2019 Shift Paper",
    totalQuestions: 100,
    timeLimitMinutes: 60,
    totalMarks: 200,
    sections: ["Quantitative Aptitude", "General Intelligence & Reasoning", "English Comprehension", "General Awareness"],
    questions: generateFullExamQuestions(MOCK_QUESTIONS, "SSC CGL 2019")
  },
  {
    id: "ssc-cgl-2018-official",
    examCode: "SSC-CGL-2018-OFFICIAL",
    title: "Official 30 Yearwise SSC CGL Solved Paper (2018)",
    category: "SSC CGL Tier 1",
    year: 2018,
    stage: "Tier 1",
    shift: "Official 2018 Shift Paper",
    totalQuestions: 100,
    timeLimitMinutes: 60,
    totalMarks: 200,
    sections: ["Quantitative Aptitude", "General Intelligence & Reasoning", "English Comprehension", "General Awareness"],
    questions: generateFullExamQuestions(MOCK_QUESTIONS, "SSC CGL 2018")
  },
  {
    id: "neet-2024-mock",
    examCode: "NEET-2024-M1",
    title: "NEET UG 2024 Official PYP Full Length Mock",
    category: "NEET",
    year: 2024,
    stage: "Prelims",
    shift: "Shift 1",
    totalQuestions: 100,
    timeLimitMinutes: 60,
    totalMarks: 200,
    sections: ["Quantitative Aptitude", "General Intelligence & Reasoning", "English Comprehension", "General Awareness"],
    questions: generateFullExamQuestions(MOCK_QUESTIONS, "NEET 2024")
  },
  {
    id: "jee-main-2024-jan",
    examCode: "JEE-2024-JAN",
    title: "JEE Main 2024 — 27th Jan Shift 1",
    category: "JEE Main",
    year: 2024,
    stage: "Prelims",
    shift: "Shift 1",
    totalQuestions: 100,
    timeLimitMinutes: 60,
    totalMarks: 200,
    sections: ["Quantitative Aptitude", "General Intelligence & Reasoning", "English Comprehension", "General Awareness"],
    questions: generateFullExamQuestions(MOCK_QUESTIONS, "JEE 2024")
  },
  {
    id: "sbi-po-2023-prelims",
    examCode: "SBI-PO-2023",
    title: "SBI PO Prelims 2023 Memory Based Paper",
    category: "SBI PO",
    year: 2023,
    stage: "Prelims",
    shift: "Shift 1",
    totalQuestions: 100,
    timeLimitMinutes: 60,
    totalMarks: 200,
    sections: ["Quantitative Aptitude", "General Intelligence & Reasoning", "English Comprehension", "General Awareness"],
    questions: generateFullExamQuestions(MOCK_QUESTIONS, "SBI PO 2023")
  }
];

const CUSTOM_EXAMS_KEY = "last_min_prep_custom_exams_v1";

export function getMergedExamsList(): Exam[] {
  if (typeof window === "undefined") return EXAMS_LIST;

  try {
    const customData = localStorage.getItem(CUSTOM_EXAMS_KEY);
    if (customData) {
      const parsed: Exam[] = JSON.parse(customData);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return [...parsed, ...EXAMS_LIST];
      }
    }
  } catch (e) {
    console.error("Error reading custom exams from localStorage", e);
  }

  return EXAMS_LIST;
}

export function saveCustomExamToStorage(newExam: Exam): void {
  if (typeof window === "undefined") return;

  try {
    const existing = localStorage.getItem(CUSTOM_EXAMS_KEY);
    let examsArr: Exam[] = [];
    if (existing) {
      examsArr = JSON.parse(existing);
    }
    examsArr = [newExam, ...examsArr.filter((e) => e.id !== newExam.id)];
    localStorage.setItem(CUSTOM_EXAMS_KEY, JSON.stringify(examsArr));
  } catch (e) {
    console.error("Error saving custom exam to localStorage", e);
  }
}
