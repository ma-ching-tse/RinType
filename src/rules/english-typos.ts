import type { Rule } from './interface';
import type { TextIssue } from '../types';

// Common English misspellings that are wrong in BOTH US and UK spelling conventions.
// Curated from Wikipedia's "Lists of common misspellings"; intentionally narrow to
// avoid false positives. Words with valid regional variants (colour/color, organise/organize)
// are NOT included.
//
// Add a typo here only if you're confident it's never a valid spelling anywhere.
const TYPOS: Record<string, string> = {
  'accomodate': 'accommodate',
  'achive': 'achieve',
  'acomodate': 'accommodate',
  'acheive': 'achieve',
  'adress': 'address',
  'arguement': 'argument',
  'basicly': 'basically',
  'becuase': 'because',
  'begining': 'beginning',
  'beleive': 'believe',
  'beween': 'between',
  'calender': 'calendar',
  'cemetary': 'cemetery',
  'comming': 'coming',
  'commitee': 'committee',
  'commited': 'committed',
  'completly': 'completely',
  'concious': 'conscious',
  'definate': 'definite',
  'definately': 'definitely',
  'definatly': 'definitely',
  'develope': 'develop',
  'diferent': 'different',
  'embarass': 'embarrass',
  'enviroment': 'environment',
  'existance': 'existence',
  'experiance': 'experience',
  'familar': 'familiar',
  'finaly': 'finally',
  'foriegn': 'foreign',
  'fourty': 'forty',
  'freind': 'friend',
  'gaurantee': 'guarantee',
  'goverment': 'government',
  'happend': 'happened',
  'harrass': 'harass',
  'hieght': 'height',
  'immediatly': 'immediately',
  'independant': 'independent',
  'interupt': 'interrupt',
  'irrelevent': 'irrelevant',
  'knowlege': 'knowledge',
  'liason': 'liaison',
  'libary': 'library',
  'maintainance': 'maintenance',
  'managment': 'management',
  'mispell': 'misspell',
  'neccesary': 'necessary',
  'neccessary': 'necessary',
  'noticable': 'noticeable',
  'occassion': 'occasion',
  'occured': 'occurred',
  'occurence': 'occurrence',
  'oppurtunity': 'opportunity',
  'paralel': 'parallel',
  'particulary': 'particularly',
  'percieve': 'perceive',
  'perminent': 'permanent',
  'posession': 'possession',
  'preceeding': 'preceding',
  'priviledge': 'privilege',
  'probaly': 'probably',
  'proffessional': 'professional',
  'pronounciation': 'pronunciation',
  'publically': 'publicly',
  'recieve': 'receive',
  'reccomend': 'recommend',
  'recomend': 'recommend',
  'refered': 'referred',
  'relevent': 'relevant',
  'religous': 'religious',
  'remeber': 'remember',
  'repetative': 'repetitive',
  'resturant': 'restaurant',
  'rythm': 'rhythm',
  'seperate': 'separate',
  'seperately': 'separately',
  'sieze': 'seize',
  'similiar': 'similar',
  'sincerly': 'sincerely',
  'speach': 'speech',
  'succesful': 'successful',
  'succesfully': 'successfully',
  'supercede': 'supersede',
  'suprise': 'surprise',
  'thier': 'their',
  'tommorow': 'tomorrow',
  'tommorrow': 'tomorrow',
  'truely': 'truly',
  'untill': 'until',
  'usefull': 'useful',
  'visable': 'visible',
  'wether': 'whether',
  'writting': 'writing',
  'yeild': 'yield',

  // Crypto / fintech context
  'blockchian': 'blockchain',
  'crytpo': 'crypto',
  'transcation': 'transaction',
  'trasaction': 'transaction',
  'widthdraw': 'withdraw',
  'widthdrawal': 'withdrawal',
  'sucessful': 'successful',
};

const sortedKeys = Object.keys(TYPOS).sort((a, b) => b.length - a.length);
const BOUNDARY = `[\\s，。！？、；：""''（）\\[\\]{}.,!?;:\\'\"()\\-/]`;
const PATTERN = new RegExp(
  `(?:^|${BOUNDARY})(${sortedKeys.map(escapeRegex).join('|')})(?=$|${BOUNDARY})`,
  'gi'
);

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Preserve the original case pattern (lowercase/Capitalized/UPPER) when suggesting the fix.
function matchCase(original: string, correct: string): string {
  if (original === original.toUpperCase()) return correct.toUpperCase();
  if (original[0] === original[0].toUpperCase()) {
    return correct[0].toUpperCase() + correct.slice(1);
  }
  return correct;
}

export const englishTypos: Rule = {
  id: 'english-typos',
  name: '英文拼写错误',
  description: '常见英文拼写错误（高确定性、不含地区拼写差异）',
  severity: 'warning',

  check(text: string): TextIssue[] {
    const issues: TextIssue[] = [];
    const regex = new RegExp(PATTERN.source, PATTERN.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const found = match[1];
      const wordOffset = match.index + match[0].length - found.length;
      const canonical = TYPOS[found.toLowerCase()];
      if (!canonical) continue;
      const correct = matchCase(found, canonical);
      if (found === correct) continue;

      issues.push({
        ruleId: this.id,
        message: `「${found}」拼写错误，应为「${correct}」`,
        original: found,
        replacement: correct,
        offset: wordOffset,
        length: found.length,
      });
    }

    return issues;
  },

  fix(text: string): string {
    const regex = new RegExp(PATTERN.source, PATTERN.flags);
    return text.replace(regex, (fullMatch, word: string) => {
      const canonical = TYPOS[word.toLowerCase()];
      if (!canonical) return fullMatch;
      const correct = matchCase(word, canonical);
      if (word === correct) return fullMatch;
      return fullMatch.slice(0, fullMatch.length - word.length) + correct;
    });
  },
};
