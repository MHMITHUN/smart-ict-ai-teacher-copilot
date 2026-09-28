/**
 * Deterministic topic library behind the mock provider (spec 36: demo
 * honesty). Each entry carries genuinely correct SSC/HSC ICT teaching
 * material for a common curriculum topic; an honest generic fallback
 * (parameterised by the teacher's topic) covers everything else.
 *
 * Mock output is always stamped provider "mock" — it never claims a real
 * model was called — but it must still be useful, never lorem ipsum.
 */

export interface MockMcq {
  prompt: string;
  options: [string, string, string, string];
  answer: string;
  explanation: string;
}

export interface MockQa {
  q: string;
  a: string;
  explanation: string;
}

export interface MockTrueFalse {
  statement: string;
  answer: "true" | "false";
  explanation: string;
}

export interface MockCloze {
  sentence: string;
  answer: string;
}

export interface TopicProfile {
  summary: string;
  analogy: string;
  example: string;
  misconception: string;
  mcq: MockMcq[];
  qa: MockQa[];
  tf: MockTrueFalse[];
  cloze: MockCloze[];
  /** True when this is the generic fallback for an unknown topic. */
  generic: boolean;
}

interface LibraryEntry extends Omit<TopicProfile, "generic"> {
  match: RegExp;
}

const LIBRARY: LibraryEntry[] = [
  {
    match: /number system|binary|decimal|hexadecimal|octal|conversion|\bbit\b|\bbyte\b|positional/i,
    summary:
      "In a computer, every number, letter and picture is stored using only the digits 0 and 1 — the binary system. Each position in a binary number is worth double the position to its right, so 1011 means 8 + 0 + 2 + 1 = 11 in decimal. Hexadecimal (base 16) is used as a shorthand for long binary strings because every hex digit stands for exactly 4 bits.",
    analogy:
      "Think of a row of light switches: each switch is worth double the one on its right, and you turn switches on (1) or off (0) to build exactly the total you want.",
    example:
      "Convert decimal 13 to binary: 13 = 8 + 4 + 1, so write 1 under 8, 1 under 4, 0 under 2 and 1 under 1, giving 1101.",
    misconception:
      "Students often write the place values in the wrong order (right to left starting at 1 gets reversed) so the converted number comes out backwards.",
    mcq: [
      {
        prompt: "What is the binary representation of the decimal number 25?",
        options: ["10011", "11001", "10101", "11100"],
        answer: "11001",
        explanation: "25 = 16 + 8 + 1 = 11001 in binary.",
      },
      {
        prompt: "How many bits are there in one byte?",
        options: ["4", "8", "16", "32"],
        answer: "8",
        explanation: "One byte is a group of 8 bits.",
      },
    ],
    qa: [
      {
        q: "What is the decimal value of the binary number 1011? Show your working.",
        a: "11, because 8 + 0 + 2 + 1 = 11.",
        explanation: "Expand the place values 8, 4, 2, 1 over the digits 1, 0, 1, 1.",
      },
      {
        q: "What is the hexadecimal digit for the decimal number 14?",
        a: "E",
        explanation: "Hexadecimal digits run 0-9 then A-F, so 10=A, 11=B, 12=C, 13=D, 14=E, 15=F.",
      },
    ],
    tf: [
      {
        statement: "One byte is a group of 8 bits.",
        answer: "true",
        explanation: "By definition, 1 byte = 8 bits.",
      },
      {
        statement: "The binary number system uses the digits 0, 1 and 2.",
        answer: "false",
        explanation: "Binary (base 2) uses only the digits 0 and 1.",
      },
    ],
    cloze: [
      { sentence: "One byte is a group of ___ bits.", answer: "8 (eight)" },
      { sentence: "The binary number system uses only the digits 0 and ___.", answer: "1 (one)" },
    ],
  },
  {
    match: /network|internet|lan|wan|topolog|protocol|ip address|router|wi-?fi|ethernet|www|web browser/i,
    summary:
      "A computer network connects computers so they can share files, printers and an internet connection. The internet is a worldwide network of networks that follows common rules called protocols so that different devices can understand each other. Every device on a network has an IP address so data is delivered to the right place.",
    analogy:
      "A network works like a school postal system: every room (device) has an address (IP address), and every letter (data packet) carries the destination address so the postman (router) knows where to deliver it.",
    example:
      "In a star topology lab, if the central switch fails the whole lab loses connection, but one broken cable affects only that single computer.",
    misconception:
      "Students often mix up the internet (the global network of networks) with the World Wide Web (one service that runs on top of it).",
    mcq: [
      {
        prompt: "What does an IP address identify?",
        options: [
          "The password of a user",
          "A device on a network",
          "The brand of a computer",
          "The speed of a connection",
        ],
        answer: "A device on a network",
        explanation: "An IP address uniquely identifies a device so packets reach the right place.",
      },
      {
        prompt: "Which network covers the smallest area?",
        options: ["WAN", "MAN", "LAN", "The internet"],
        answer: "LAN",
        explanation: "A Local Area Network covers a single room, lab or building.",
      },
    ],
    qa: [
      {
        q: "Name the two main types of network classified by coverage area.",
        a: "LAN (Local Area Network) and WAN (Wide Area Network).",
        explanation: "A LAN covers a small area like a lab; a WAN connects networks across cities or countries.",
      },
      {
        q: "What does a router do in a network?",
        a: "It forwards data packets between networks, choosing the best path for each packet.",
        explanation: "Switches move frames inside one LAN; routers move packets between networks.",
      },
    ],
    tf: [
      {
        statement: "The World Wide Web and the internet are the same thing.",
        answer: "false",
        explanation: "The web is a service that runs on the internet, which is the network itself.",
      },
      {
        statement: "In a star topology, all devices connect to a central device.",
        answer: "true",
        explanation: "A central switch or hub connects every device in star topology.",
      },
    ],
    cloze: [
      { sentence: "LAN stands for ___ Area Network.", answer: "Local" },
      { sentence: "A ___ forwards data packets between different networks.", answer: "router" },
    ],
  },
  {
    match: /database|sql|table|record|field|query|primary key|dbms/i,
    summary:
      "A database stores information in an organised way so it can be found, sorted and updated quickly. In a relational database, data lives in tables made of rows (records) and columns (fields), and a primary key uniquely identifies each row. SQL is the standard language for asking a database questions.",
    analogy:
      "A database table is like a class register: each student is a row, each column holds one kind of information (roll, name, marks), and the roll number is the primary key that no two students share.",
    example:
      "SELECT name, marks FROM Students WHERE marks >= 80; shows only the name and marks columns of the students who scored 80 or more.",
    misconception:
      "Students often think SQL SELECT chooses rows — it actually lists the columns to display, while the WHERE clause chooses the rows.",
    mcq: [
      {
        prompt: "What is the purpose of a primary key?",
        options: [
          "To encrypt the table",
          "To uniquely identify each record",
          "To sort records alphabetically",
          "To link to the internet",
        ],
        answer: "To uniquely identify each record",
        explanation: "No two records may share a primary key value.",
      },
      {
        prompt: "In a table, what is one complete row called?",
        options: ["A field", "A query", "A record", "A key"],
        answer: "A record",
        explanation: "A record holds all the data about one item; a field is one column.",
      },
    ],
    qa: [
      {
        q: "Write an SQL statement that shows all columns of a table named Students.",
        a: "SELECT * FROM Students;",
        explanation: "SELECT lists the columns (* means all) and FROM names the table.",
      },
      {
        q: "What is the difference between a record and a field?",
        a: "A record is one complete row about a single item; a field is one column holding a single kind of data.",
        explanation: "For example, one student's full row is a record; the marks column is a field.",
      },
    ],
    tf: [
      {
        statement: "In a table, a field is a column and a record is a row.",
        answer: "true",
        explanation: "Fields describe categories of data; records are the complete entries.",
      },
      {
        statement: "Two records in a table may have the same primary key value.",
        answer: "false",
        explanation: "Primary key values must be unique — that is the whole point of the key.",
      },
    ],
    cloze: [
      { sentence: "In a table, one complete row is called a ___.", answer: "record" },
      { sentence: "The ___ key uniquely identifies each record in a table.", answer: "primary" },
    ],
  },
  {
    match: /algorithm|flowchart|\bc\b|c program|c language|variable|loop|condition|array|function|compiler|debug|coding|programming/i,
    summary:
      "A program is a list of exact instructions the computer follows one by one. Before coding, we plan the logic with an algorithm or a flowchart; then a compiler translates the C source code into machine language the computer can run. Variables store values that can change while the program runs.",
    analogy:
      "A program is like a recipe: every step must be exact and in order, and the cook (computer) never guesses — if a step is wrong, the dish fails, no matter how good the other steps are.",
    example:
      "To print the even numbers 2 to 10 in C: loop i from 2 to 10 increasing by 2 each time and print i — the loop condition is i <= 10.",
    misconception:
      "Students use = (assignment) where == (comparison) is needed inside an if condition, so the test always passes and the wrong branch runs.",
    mcq: [
      {
        prompt: "In C, int a = 7, b = 2; what is the value of a % b?",
        options: ["3", "3.5", "1", "0"],
        answer: "1",
        explanation: "% gives the remainder: 7 divided by 2 is 3 remainder 1.",
      },
      {
        prompt: "What does a compiler do?",
        options: [
          "Runs the program line by line without translating",
          "Translates the whole source program into machine code before it runs",
          "Draws the flowchart automatically",
          "Checks spelling in string literals",
        ],
        answer: "Translates the whole source program into machine code before it runs",
        explanation: "An interpreter runs line by line; a compiler translates the whole program first.",
      },
    ],
    qa: [
      {
        q: "What is a variable in C? Give one example declaration.",
        a: "A named memory location whose value can change while the program runs, e.g. int age = 15;",
        explanation: "The type (int) says what kind of values fit; the name is used to read and update it.",
      },
      {
        q: "What is the difference between a while loop and a do-while loop?",
        a: "A while loop tests the condition before the body (the body may run zero times); a do-while loop tests after the body (the body always runs at least once).",
        explanation: "Use do-while when the body must happen at least once, e.g. showing a menu.",
      },
    ],
    tf: [
      {
        statement: "In C, every statement ends with a semicolon.",
        answer: "true",
        explanation: "Statements end with ; — control headers like if (...) do not.",
      },
      {
        statement: "The = operator compares two values in C.",
        answer: "false",
        explanation: "= assigns a value; == compares two values.",
      },
    ],
    cloze: [
      { sentence: "In C, every statement ends with a ___.", answer: "semicolon (;)" },
      { sentence: "The ___ operator gives the remainder after division in C.", answer: "% (modulo)" },
    ],
  },
  {
    match: /html|web ?page|website|css|tag|hyperlink|\burl\b|browser/i,
    summary:
      "HTML is the language used to build web pages. Tags such as <p> and <img> tell the browser what each piece of content is, and the browser reads the tags from top to bottom to draw the page. Attributes inside a tag, like href in <a>, add extra information.",
    analogy:
      "HTML tags are like the labels on boxes during a house move: each label tells the reader what is inside, so the page (the house) gets assembled in the right order.",
    example:
      "A minimal page: <html><body><h1>ICT</h1><p>Hello class</p></body></html> draws a heading followed by a paragraph.",
    misconception:
      "Students forget to close tags or nest them wrongly, e.g. <b><i>text</b></i>, which can break the layout of the whole page.",
    mcq: [
      {
        prompt: "Which tag creates a hyperlink?",
        options: ["<link>", "<a>", "<href>", "<url>"],
        answer: "<a>",
        explanation: "The anchor tag <a> with an href attribute, e.g. <a href=\"https://example.com\">Visit</a>.",
      },
      {
        prompt: "What does HTML stand for?",
        options: [
          "HyperText Markup Language",
          "High Transfer Machine Language",
          "HyperTool Multi Language",
          "Home Text Making Language",
        ],
        answer: "HyperText Markup Language",
        explanation: "It marks up content so browsers know how to present it.",
      },
    ],
    qa: [
      {
        q: "What does the <br> tag do?",
        a: "It starts a new line (a line break); it is an empty tag, so it needs no closing tag.",
        explanation: "<p>Line one<br>Line two</p> puts the two sentences on separate lines.",
      },
      {
        q: "What is a URL? Give an example.",
        a: "The address of a web page, e.g. https://example.com/page.",
        explanation: "The browser fetches exactly the resource the URL points to.",
      },
    ],
    tf: [
      {
        statement: "The <h1> tag usually marks the most important heading on a page.",
        answer: "true",
        explanation: "Heading tags run h1 (most important) to h6.",
      },
      {
        statement: "CSS is used to store database records.",
        answer: "false",
        explanation: "CSS styles the appearance of pages; databases store records.",
      },
    ],
    cloze: [
      { sentence: "HTML stands for HyperText ___ Language.", answer: "Markup" },
      { sentence: "The <a> tag uses the ___ attribute to set the link destination.", answer: "href" },
    ],
  },
  {
    match: /security|virus|malware|hacking|password|cyber|phishing|firewall|antivirus/i,
    summary:
      "Computer security protects data and systems from damage, theft and misuse. Common threats include viruses (programs that spread and damage files) and phishing (fake messages that trick people into revealing passwords). Good habits — strong passwords, updated software, careful clicks — matter as much as security tools.",
    analogy:
      "Computer security works like protecting your house: strong locks (passwords), checking who knocks (firewall and antivirus) and never opening letters from strangers (phishing).",
    example:
      "A bank never asks for your full password by email — any message that does is phishing and should be deleted without replying.",
    misconception:
      "Students believe an antivirus makes a computer immune; it only catches known threats, so updates and safe habits still matter.",
    mcq: [
      {
        prompt: "What is phishing?",
        options: [
          "A sport played on computers",
          "Fake messages that trick people into revealing secrets",
          "A type of computer screen",
          "A way to speed up a network",
        ],
        answer: "Fake messages that trick people into revealing secrets",
        explanation: "Phishing messages imitate banks or services to steal passwords and card numbers.",
      },
      {
        prompt: "Which of these is the strongest password?",
        options: ["12345678", "mahamudul", "Tk7#qzL!2vX", "password1"],
        answer: "Tk7#qzL!2vX",
        explanation: "Long, unpredictable mixes of letters, digits and symbols are hardest to crack.",
      },
    ],
    qa: [
      {
        q: "What is a computer virus?",
        a: "A malicious program that copies itself and damages files or slows the computer down.",
        explanation: "It usually spreads when an infected file or attachment is opened or shared.",
      },
      {
        q: "Give two qualities of a strong password.",
        a: "At least 8-12 characters, mixing uppercase and lowercase letters, digits and symbols, and not a name or dictionary word.",
        explanation: "Length plus unpredictability is what makes brute-force guessing slow.",
      },
    ],
    tf: [
      {
        statement: "Sharing your password with a close friend is safe security practice.",
        answer: "false",
        explanation: "A password must stay private — sharing it breaks accountability and safety.",
      },
      {
        statement: "Antivirus software should be updated regularly.",
        answer: "true",
        explanation: "Updates teach it the newest threats; an out-of-date scanner misses new malware.",
      },
    ],
    cloze: [
      { sentence: "A ___ is a malicious program that spreads by copying itself.", answer: "virus" },
      { sentence: "Fake messages that trick people into sharing passwords are called ___.", answer: "phishing" },
    ],
  },
];

/** Generic fallback for topics outside the library — still parameterised and honest. */
function genericProfile(topic: string): TopicProfile {
  return {
    summary: `${topic} is an important topic in the ICT curriculum. A strong first lesson defines ${topic} in one clear sentence, shows one worked example on the board, and lets students practise immediately while the teacher circulates. Connect ${topic} to something students already know before introducing the formal terms.`,
    analogy: `Explain ${topic} by comparing it to something students know from daily life, then ask them to invent their own comparison — their attempts reveal exactly what still needs clarifying.`,
    example: `Choose one short task that uses ${topic}, solve it on the board step by step, then give the class an identical task to try alone while you check their work.`,
    misconception: `Students often memorise the definition of ${topic} without being able to use it, so always follow the definition with a worked example and a practice attempt.`,
    mcq: [
      {
        prompt: `Which study strategy works best for mastering ${topic}?`,
        options: [
          "Memorise the definition only",
          "Understand the definition and practise worked examples",
          "Skip it and hope it is not in the exam",
          "Read the heading and nothing else",
        ],
        answer: "Understand the definition and practise worked examples",
        explanation: "Definition plus guided practice is what makes a topic usable, not just recallable.",
      },
    ],
    qa: [
      {
        q: `Define ${topic} in your own words.`,
        a: `A clear one-sentence definition of ${topic} in the student's own language.`,
        explanation: `Accept any answer that captures the core idea of ${topic}.`,
      },
      {
        q: `Why is ${topic} included in the ICT course?`,
        a: `Because it is used in real computing tasks and later topics build on it.`,
        explanation: `Ask students to name one later topic that depends on ${topic}.`,
      },
    ],
    tf: [
      {
        statement: `${topic} is part of the ICT curriculum.`,
        answer: "true",
        explanation: `The teacher chose this topic from the syllabus, so it is part of the course.`,
      },
      {
        statement: `Practising examples is unnecessary once the definition of ${topic} is memorised.`,
        answer: "false",
        explanation: "Without practice, definitions are quickly forgotten and cannot be applied.",
      },
    ],
    cloze: [
      { sentence: `The topic we are studying in this lesson is ___.`, answer: topic },
    ],
    generic: true,
  };
}

/** Deterministic: same topic always resolves to the same profile. */
export function topicProfile(topic: string): TopicProfile {
  const entry = LIBRARY.find((candidate) => candidate.match.test(topic));
  if (!entry) return genericProfile(topic);
  return {
    summary: entry.summary,
    analogy: entry.analogy,
    example: entry.example,
    misconception: entry.misconception,
    mcq: entry.mcq,
    qa: entry.qa,
    tf: entry.tf,
    cloze: entry.cloze,
    generic: false,
  };
}
