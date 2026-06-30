const pptxgen = require('pptxgenjs');

// ========== Color Constants ==========
const C = {
  BG: '0d0d1a',
  GOLD: 'd4af37',
  TEXT_MAIN: 'f5f0e8',
  TEXT_SEC: 'c8bfa8',
  GREEN: '4a9e5c',
  RED: '9b3d3d',
  BLUE: '6bb8d4',
  TABLE_HEAD: '1a1a2e',
  TABLE_ROW1: '12121f',
  TABLE_ROW2: '0d0d1a',
  CARD_BG: '161625'
};

// ========== Helpers ==========
function addGoldLine(slide) {
  slide.addShape(pres.ShapeType.rect, {
    x: 0.5, y: 7.15, w: 12.33, h: 0.02,
    fill: { color: C.GOLD }
  });
}

function addTitle(slide, text) {
  slide.addText(text, {
    x: 0.6, y: 0.35, w: 12, h: 0.7,
    fontSize: 28, color: C.GOLD, fontFace: 'Georgia',
    bold: true, align: 'left'
  });
  slide.addShape(pres.ShapeType.rect, {
    x: 0.6, y: 1.05, w: 2.5, h: 0.03,
    fill: { color: C.GOLD }
  });
}

function addBodyText(slide, text, opts = {}) {
  return slide.addText(text, {
    x: 0.6, y: 1.35, w: 12, h: 5.5,
    fontSize: 15, color: C.TEXT_MAIN, fontFace: 'Microsoft YaHei',
    lineSpacing: 28, align: 'left', valign: 'top',
    ...opts
  });
}

// ========== Slide Builders ==========
function buildCover(pres, titleEn, titleCn, tagline) {
  const slide = pres.addSlide();
  slide.background = { color: C.BG };
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: 13.33, h: 7.5,
    fill: { color: C.BG }
  });
  // Decorative corner lines
  slide.addShape(pres.ShapeType.rect, { x: 0.8, y: 1.2, w: 2, h: 0.03, fill: { color: C.GOLD } });
  slide.addShape(pres.ShapeType.rect, { x: 0.8, y: 1.2, w: 0.03, h: 1.2, fill: { color: C.GOLD } });
  slide.addShape(pres.ShapeType.rect, { x: 10.5, y: 6.0, w: 2, h: 0.03, fill: { color: C.GOLD } });
  slide.addShape(pres.ShapeType.rect, { x: 12.5, y: 4.8, w: 0.03, h: 1.2, fill: { color: C.GOLD } });

  slide.addText(titleEn, {
    x: 0.8, y: 2.0, w: 11.7, h: 0.8,
    fontSize: 38, color: C.GOLD, fontFace: 'Georgia',
    bold: true, align: 'center'
  });
  slide.addText(titleCn, {
    x: 0.8, y: 2.9, w: 11.7, h: 0.9,
    fontSize: 44, color: C.TEXT_MAIN, fontFace: 'Microsoft YaHei',
    bold: true, align: 'center'
  });
  slide.addShape(pres.ShapeType.rect, {
    x: 5.5, y: 3.9, w: 2.33, h: 0.03,
    fill: { color: C.GOLD }
  });
  slide.addText(tagline, {
    x: 0.8, y: 4.2, w: 11.7, h: 0.6,
    fontSize: 20, color: C.TEXT_SEC, fontFace: 'Microsoft YaHei',
    align: 'center', italic: true
  });
  addGoldLine(slide);
}

function buildTOC(pres, sections) {
  const slide = pres.addSlide();
  slide.background = { color: C.BG };
  addTitle(slide, '目录 CONTENTS');
  const rows = sections.map((s, i) => [
    { text: `0${i + 1}`, options: { color: C.GOLD, bold: true, fontSize: 18, align: 'center' } },
    { text: s, options: { color: C.TEXT_MAIN, fontSize: 18 } }
  ]);
  slide.addTable(rows, {
    x: 0.6, y: 1.4, w: 12, h: 5.4,
    colW: [1.2, 10.8],
    border: { pt: 0.5, color: '2a2a3e' },
    fill: { color: C.TABLE_ROW1 },
    color: C.TEXT_MAIN, fontSize: 18, fontFace: 'Microsoft YaHei',
    rowH: 0.75, valign: 'middle'
  });
  addGoldLine(slide);
}

function buildContentSlide(pres, title, paragraphs, extraAccent) {
  const slide = pres.addSlide();
  slide.background = { color: C.BG };
  addTitle(slide, title);
  const textObjs = paragraphs.map((p, i) => {
    const isBold = p.startsWith('【');
    const color = extraAccent && i === 0 ? extraAccent : C.TEXT_MAIN;
    return {
      text: p,
      options: { bold: isBold, color, breakLine: true }
    };
  });
  slide.addText(textObjs, {
    x: 0.6, y: 1.35, w: 12, h: 5.5,
    fontSize: 15, fontFace: 'Microsoft YaHei',
    lineSpacing: 28, align: 'left', valign: 'top'
  });
  addGoldLine(slide);
}

function buildTableSlide(pres, title, headers, rows) {
  const slide = pres.addSlide();
  slide.background = { color: C.BG };
  addTitle(slide, title);
  const tableRows = [
    headers.map(h => ({ text: h, options: { bold: true, color: C.GOLD, fill: C.TABLE_HEAD } })),
    ...rows.map((r, i) => r.map(c => ({
      text: c,
      options: { fill: i % 2 === 0 ? C.TABLE_ROW1 : C.TABLE_ROW2 }
    })))
  ];
  slide.addTable(tableRows, {
    x: 0.6, y: 1.35, w: 12, h: 5.5,
    border: { pt: 0.5, color: '2a2a3e' },
    colW: [3, 9],
    fontSize: 14, color: C.TEXT_MAIN, fontFace: 'Microsoft YaHei',
    valign: 'middle', autoPage: true
  });
  addGoldLine(slide);
}

function buildCardsSlide(pres, title, items, color) {
  const slide = pres.addSlide();
  slide.background = { color: C.BG };
  addTitle(slide, title);
  const cardH = 5.3 / items.length;
  items.forEach((item, i) => {
    const y = 1.35 + i * (cardH + 0.15);
    // card bg
    slide.addShape(pres.ShapeType.rect, {
      x: 0.6, y, w: 12, h: cardH,
      fill: { color: C.CARD_BG },
      line: { color: color, pt: 1.5 }
    });
    // bullet
    slide.addShape(pres.ShapeType.rect, {
      x: 0.8, y: y + 0.18, w: 0.12, h: 0.12,
      fill: { color: color }
    });
    slide.addText(item.title, {
      x: 1.1, y: y + 0.1, w: 11.2, h: 0.35,
      fontSize: 16, color, fontFace: 'Microsoft YaHei',
      bold: true
    });
    slide.addText(item.desc, {
      x: 1.1, y: y + 0.5, w: 11.2, h: cardH - 0.6,
      fontSize: 14, color: C.TEXT_MAIN, fontFace: 'Microsoft YaHei',
      lineSpacing: 24, align: 'left', valign: 'top'
    });
  });
  addGoldLine(slide);
}

function buildSummarySlide(pres, title, lines) {
  const slide = pres.addSlide();
  slide.background = { color: C.BG };
  addTitle(slide, title);
  const textObjs = lines.map(l => ({
    text: l + '\n',
    options: { breakLine: true }
  }));
  slide.addText(textObjs, {
    x: 0.6, y: 1.6, w: 12, h: 5.0,
    fontSize: 17, color: C.TEXT_MAIN, fontFace: 'Microsoft YaHei',
    lineSpacing: 34, align: 'center', valign: 'middle'
  });
  // Decorative diamond
  slide.addShape(pres.ShapeType.diamond, {
    x: 6.4, y: 1.15, w: 0.25, h: 0.25,
    fill: { color: C.GOLD }
  });
  addGoldLine(slide);
}

// ========== Scheme Data ==========
const schemes = [
  {
    file: '方案一-方舟堡的遗志.pptx',
    titleEn: 'THE BASTION\'S LEGACY',
    titleCn: '方案一：方舟堡的遗志',
    tagline: '当城堡本身就是意志，指挥官便是它的灵魂',
    accent: null,
    slides: [
      { type: 'content', title: '01 方案核心概念 CORE CONCEPT', paragraphs: [
        '【存在形式】玩家没有游戏内的肉身或灵魂。',
        '玩家的"存在"体现为方舟堡本身的意志系统——城堡在圣心城陷落时被世界树残留的魂能激活，成为一座有自主判断能力的活体要塞。',
        '玩家就是这座要塞的"操作系统"。'
      ]},
      { type: 'content', title: '02 玩家身份定位 PLAYER IDENTITY', paragraphs: [
        '【方舟堡的意志系统】',
        '统领资格来自方舟堡——圣心城最后的遗产，内置圣心城议会的权限协议。',
        '领主响应的是圣心城的紧急动员令，而非个人命令。',
        '玩家=城堡，城堡=玩家，二者不可分割。'
      ]},
      { type: 'content', title: '03 城堡转移机制 CASTLE TRANSFER', paragraphs: [
        '【底座嵌入符文通道根节点】',
        '方舟堡通过激活锚点整体传送到不同大陆。',
        '每次传送需要目标大陆领主开启接收端。',
        '城堡本身即为传送核心，无需额外载具。'
      ]},
      { type: 'content', title: '04 城堡攻击逻辑 ATTACK LOGIC', paragraphs: [
        '【被动吸引机制】',
        '城堡核心的世界树活体根须散发纯净魂能，像灯塔一样被动吸引深渊造物和失控元素生物。',
        '敌人并非"追杀"玩家，而是被魂能光芒吸引而至。',
        '这解释了为何每到一个新大陆，敌人便蜂拥而至。'
      ]},
      { type: 'content', title: '05 玩家涉险原因 WHY THE PLAYER TAKES RISKS', paragraphs: [
        '【移动修复站】',
        '远程修复不可能，封魂令裂痕需要物理接近才能通过城堡的世界树根须进行"魂能谐振"。',
        '城堡是"移动修复站"，必须亲临每个大陆的封魂令石碑。',
        '玩家在场=修复可行；玩家缺席=裂痕持续扩大。'
      ]},
      { type: 'table', title: '06 世界观一致性分析 CONSISTENCY', headers: ['一致性维度', '对应说明'],
        rows: [
          ['方舟堡来源', '方舟堡=圣心城遗产→法统继承合法'],
          ['城堡核心', '城堡核心=世界树根须→与三界设定贯通'],
          ['传送机制', '传送依赖符文通道→与既有世界架构一致'],
          ['敌人动机', '魂能灯塔效应→被动吸引解释攻击逻辑']
        ]
      },
      { type: 'cards', title: '07 优点 ADVANTAGES', color: C.GREEN, items: [
        { title: '保持"玩家无肉身"设定', desc: '完全避免"玩家在游戏里是什么"的叙事矛盾，塔防叙事中最干净的方案。' },
        { title: '城堡=玩家化身', desc: '塔防游戏中"城堡即玩家"是最强叙事耦合，升级城堡=玩家成长，直观无歧义。' },
        { title: '无需处理死亡逻辑', desc: '城堡被毁=Game Over，不需要解释"玩家角色死后复活"的叙事漏洞。' }
      ]},
      { type: 'cards', title: '08 缺点 DISADVANTAGES', color: C.RED, items: [
        { title: '叙事情感偏弱', desc: '城堡作为"物"很难建立情感共鸣，玩家可能感觉在操控一座建筑而非代入一个角色。' },
        { title: '难制造个人危机张力', desc: '危机=城堡受损，而非"角色命悬一线"，情感冲击力度天然弱于有人身的方案。' },
        { title: '领主忠诚逻辑', desc: '领主对"城堡"的忠诚不如对"人"自然，需要额外叙事铺垫来解释为何追随一座会移动的要塞。' }
      ]},
      { type: 'cards', title: '09 玩法影响 GAMEPLAY IMPACT', color: C.BLUE, items: [
        { title: '城堡升级=玩家成长', desc: '所有养成系统围绕城堡展开：城墙、炮塔、根须网络，成长线清晰统一。' },
        { title: '城堡被毁=Game Over', desc: '失败条件自然明确，无需设计复杂的角色死亡与复活机制。' },
        { title: '符文通道传送=解锁条件', desc: '大陆解锁与符文通道节点绑定，形成清晰的章节推进节奏。' }
      ]},
      { type: 'summary', title: '10 总结 SUMMARY', lines: [
        '方案一是最"塔防原生"的玩家身份设定。',
        '将玩家与城堡合二为一，叙事干净、玩法耦合度最高。',
        '代价是情感深度和角色弧线的牺牲。',
        '适合追求"纯粹塔防体验"、弱化叙事情感权重的项目方向。'
      ]}
    ]
  },
  {
    file: '方案二-圣心城执政官.pptx',
    titleEn: 'THE LAST CONSUL',
    titleCn: '方案二：圣心城最后的执政官',
    tagline: '没有神力的凡人，却手持凡界最后的合法秩序',
    accent: null,
    slides: [
      { type: 'content', title: '01 方案核心概念 CORE CONCEPT', paragraphs: [
        '【冬眠的凡人执政官】',
        '玩家是圣心城陷落时唯一幸存的执政官候选人——被世界树根须以魂能"冬眠"数十年的凡人。',
        '苏醒后没有记忆、没有战斗力，但佩戴着圣心城的执政印信——九大陆领主承认的最高协调权威。'
      ]},
      { type: 'content', title: '02 玩家身份定位 PLAYER IDENTITY', paragraphs: [
        '【凡界的"联合国秘书长"】',
        '拥有危机时刻协调联合行动的合法授权。',
        '执政印信是九封魂令锻造时同步制作的第十件信物。',
        '执政官是文职非武职，不直接参战，而是统筹全局。'
      ]},
      { type: 'content', title: '03 城堡转移机制 CASTLE TRANSFER', paragraphs: [
        '【地下根脉航行】',
        '方舟堡是圣心城核心区碎片，沿世界树地下根脉网络滑行，像地下河流中航行的船。',
        '每到新大陆从地底升起，离开时沉入地下。',
        '根脉网络=天然的高速通道，也是世界树生命力的脉络。'
      ]},
      { type: 'content', title: '04 城堡攻击逻辑 ATTACK LOGIC', paragraphs: [
        '【双重打击机制】',
        '被动吸引：魂能灯塔效应持续吸引深渊造物。',
        '主动打击：恢复秩序威胁深渊战略目标，格拉姆萨斯派遣有组织攻击。',
        '随着故事推进，敌人的组织度和针对性逐步提升。'
      ]},
      { type: 'content', title: '05 玩家涉险原因 WHY THE PLAYER TAKES RISKS', paragraphs: [
        '【印信触碰机制】',
        '执政印信需物理接触封魂令石碑激活"联合协议"——这是防远程篡权的安全机制。',
        '执政官存在=凡界团结象征，阵亡则各大陆陷入各自为战。',
        '玩家虽弱，但不可替代。'
      ]},
      { type: 'table', title: '06 世界观一致性分析 CONSISTENCY', headers: ['一致性维度', '对应说明'],
        rows: [
          ['执政官身份', '执政官=凡界政治角色→不参战逻辑自洽'],
          ['城堡移动', '城堡沿根脉移动→与世界树设定深度绑定'],
          ['印信来源', '印信与封魂令同源→合法性的神话基础'],
          ['深渊动机', '凡界秩序重建威胁深渊→格拉姆萨斯主动出击合理']
        ]
      },
      { type: 'cards', title: '07 优点 ADVANTAGES', color: C.GREEN, items: [
        { title: '身份和动机清晰', desc: '"凡人执政官"一目了然，玩家 instantly 理解自己是谁、为何在此、能做什么。' },
        { title: '不参战逻辑自洽', desc: '文职身份天然解释为何玩家不直接上战场，而依赖英雄和防御塔。' },
        { title: '印信确认=解锁驱动', desc: '每块大陆需要印信激活，形成强有力的叙事推进动机。' },
        { title: '可发展外交系统', desc: '执政官身份天然适配声望、外交、联盟等后期系统扩展。' }
      ]},
      { type: 'cards', title: '08 缺点 DISADVANTAGES', color: C.RED, items: [
        { title: '缺少神秘感和后期揭示', desc: '身份从开场即完整揭示，缺少"我是谁"的悬念弧线和剧情反转空间。' },
        { title: '"凡人凭什么"的质疑', desc: '需要反复叙事解释为何一个凡人能号令九大陆领主和神话英雄。' },
        { title: '与艾蕾尼娅联系需解释', desc: '世界树守护者为何关注一个凡人，需要额外铺垫才能合理化。' }
      ]},
      { type: 'cards', title: '09 玩法影响 GAMEPLAY IMPACT', color: C.BLUE, items: [
        { title: '印信确认=特殊关卡', desc: '每章包含"印信激活"特殊关卡，玩法节奏变化，避免纯塔防单调。' },
        { title: '声望/外交系统', desc: '执政官身份支撑声望系统和多大陆外交策略，增加meta层深度。' },
        { title: '根脉移动=过渡动画', desc: '地下根脉滑行的过场动画，视觉冲击力强，章节衔接仪式感十足。' }
      ]},
      { type: 'summary', title: '10 总结 SUMMARY', lines: [
        '方案二是最"政治写实"的玩家身份设定。',
        '身份清晰、动机明确、系统扩展性强。',
        '代价是神秘感和剧情揭示深度的削弱。',
        '适合重视叙事清晰度和系统可扩展性的项目方向。'
      ]}
    ]
  },
  {
    file: '方案三-世界树的回响者.pptx',
    titleEn: 'ECHO OF YGGDRASIL',
    titleCn: '方案三：世界树的回响者',
    tagline: '世界树临终前的最后一个念头，化为了你的意识',
    accent: C.GREEN,
    slides: [
      { type: 'content', title: '01 方案核心概念 CORE CONCEPT', paragraphs: [
        '【世界树的一缕回响】',
        '玩家是世界树在凡界投射的最后一缕意识回响。',
        '世界树在圣心城崩溃时注入了最后一丝清醒意识到方舟堡核心根须。',
        '玩家不是世界树本身，是"临终前的一个念头"——有使命但不知来源的意识体。',
        '没有肉身，以光影/魂能投影存在，能感知各大陆元素脉动。'
      ], accent: C.GREEN },
      { type: 'content', title: '02 玩家身份定位 PLAYER IDENTITY', paragraphs: [
        '【世界树最后的意识碎片】',
        '携带世界树的共鸣频率，领主们作为封魂令守锚者能本能感受，被共鸣牵引而非被命令。',
        '牵引力随故事推进增强，从"隐约感应"到"无法忽视的呼唤"。',
        '意识投影无物理干预能力，必须通过英雄执行。'
      ], accent: C.GREEN },
      { type: 'content', title: '03 城堡转移机制 CASTLE TRANSFER', paragraphs: [
        '【种子生长机制】',
        '方舟堡=世界树根须的"种子"，沿根脉网络移动，在符文通道节点"发芽生长"。',
        '转移时收缩回根脉（解体为魂能），到新位置重新"生长"。',
        '撤离时保留部分"根基"——为回访机制埋下伏笔。'
      ], accent: C.GREEN },
      { type: 'content', title: '04 城堡攻击逻辑 ATTACK LOGIC', paragraphs: [
        '【三层递进围猎】',
        '第一章（木大陆）：纯被动吸引——深渊尚未察觉世界树意识存活。',
        '第二章（冰大陆）：深渊察觉世界树意识存活，攻击组织度显著提升。',
        '第三章（火大陆）：奈克瑟尔识别真正身份，全力围攻，进入高潮。'
      ], accent: C.GREEN },
      { type: 'content', title: '05 玩家涉险原因 WHY THE PLAYER TAKES RISKS', paragraphs: [
        '【谐振续命机制】',
        '只有在封魂令石碑附近才能通过根脉建立临时谐振——不是修复，是"续命"。',
        '玩家在场可将封魂令碎裂时间从数月延长到数年。',
        '一个意识体一次只能在一处谐振，因此必须亲赴每个大陆。'
      ], accent: C.GREEN },
      { type: 'table', title: '06 世界观一致性分析 CONSISTENCY', headers: ['一致性维度', '对应说明'],
        rows: [
          ['世界树连通', '世界树连通三界→天然跨界感知，无需额外解释'],
          ['谐振机制', '谐振机制解释与封魂令互动→"续命"设定新颖且自洽'],
          ['艾蕾尼娅', '艾蕾尼娅是世界树守护者→与玩家联系天然合理，无需额外铺垫'],
          ['递进围猎', '递进围猎匹配奈克瑟尔智慧反派形象→敌人成长曲线清晰']
        ]
      },
      { type: 'cards', title: '07 优点 ADVANTAGES', color: C.GREEN, items: [
        { title: '身份揭示弧线最深', desc: '从"不知自己是谁"到"世界树回响"，拥有最完整的身份揭示弧线，剧情张力最强。' },
        { title: '与世界树设定高度契合', desc: '"回响"概念完美嵌入三界世界观，不引入任何外来元素。' },
        { title: '共鸣牵引避免权力尴尬', desc: '"被共鸣牵引"比"被命令"更优雅，领主追随是本能而非服从。' },
        { title: '递进攻击每章不同紧张感', desc: '从被动吸引到全力围攻，三章三种战斗氛围，避免重复感。' },
        { title: '可发展"世界树觉醒"史诗', desc: '为后期"世界树重生"等史诗级叙事预留最大空间。' }
      ]},
      { type: 'cards', title: '08 缺点 DISADVANTAGES', color: C.RED, items: [
        { title: '与"纯外部操控者"冲突', desc: '"意识体也是玩家化身"与"纯外部操控者"的原始设计有理念冲突，需要调和。' },
        { title: '"意识体"表达需精心设计', desc: '光影/魂能投影的视觉表现和交互设计挑战性高，处理不好会显得空洞。' },
        { title: '身份揭示处理不当破坏沉浸', desc: '如果揭示时机或方式不当，可能让玩家感到"被欺骗"而非"恍然大悟"。' }
      ]},
      { type: 'cards', title: '09 玩法影响 GAMEPLAY IMPACT', color: C.BLUE, items: [
        { title: '谐振机制=独特养成', desc: '谐振深度可作为独特养成维度，区别于传统等级/装备系统。' },
        { title: '递进难度匹配成长曲线', desc: '敌人从混乱到组织化到精英化，天然匹配玩家三章成长曲线。' },
        { title: '种子城堡=仪式感动画', desc: '城堡生长/收缩的动画充满生命力，章节过渡仪式感十足。' },
        { title: '回访机制增加策略深度', desc: '保留"根基"的设计为后期回访、多线运营等策略玩法留下空间。' }
      ]},
      { type: 'summary', title: '10 总结 SUMMARY', lines: [
        '方案三是最"史诗叙事"的玩家身份设定。',
        '身份弧线最深、世界观契合度最高、后期扩展空间最大。',
        '代价是表达难度和与原始设计概念的调和成本。',
        '适合追求"叙事驱动型塔防"、愿意投入叙事资源的精品方向。'
      ]}
    ]
  }
];

// ========== Global pres reference for helpers ==========
let pres;

// ========== Generate ==========
async function generate() {
  for (const scheme of schemes) {
    pres = new pptxgen();
    pres.defineLayout({ name: 'CUSTOM', width: 13.33, height: 7.5 });
    pres.layout = 'CUSTOM';

    // Slide 1: Cover
    buildCover(pres, scheme.titleEn, scheme.titleCn, scheme.tagline);

    // Slide 2: TOC
    const tocSections = [
      '方案核心概念 Core Concept',
      '玩家身份定位 Player Identity',
      '城堡转移机制 Castle Transfer',
      '城堡攻击逻辑 Attack Logic',
      '玩家涉险原因 Why the Player Takes Risks',
      '世界观一致性分析 Consistency',
      '优点与缺点与玩法影响 Pros & Cons & Gameplay',
      '总结 Summary'
    ];
    buildTOC(pres, tocSections);

    // Slides 3-12: Content
    for (const s of scheme.slides) {
      if (s.type === 'content') {
        buildContentSlide(pres, s.title, s.paragraphs, s.accent || null);
      } else if (s.type === 'table') {
        buildTableSlide(pres, s.title, s.headers, s.rows);
      } else if (s.type === 'cards') {
        buildCardsSlide(pres, s.title, s.items, s.color);
      } else if (s.type === 'summary') {
        buildSummarySlide(pres, s.title, s.lines);
      }
    }

    await pres.writeFile({ fileName: scheme.file });
    console.log('Generated:', scheme.file);
  }
  console.log('All 3 PPTX files generated successfully!');
}

generate().catch(err => {
  console.error('Error generating PPTX:', err);
  process.exit(1);
});
