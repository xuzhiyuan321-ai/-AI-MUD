/* ============================================================
 * 00-core.js — 核心引擎
 * 版本、常量、WK初始化、存档、玩家数据、规则、日志、道具、背包、战斗、技能、基因锁、队友
 * ============================================================ */

"use strict";
/* ============================================================
 * 《无限恐怖》H5 系列 · N1 工程骨架
 * ------------------------------------------------------------
 * 【多 AI 协作注释规范】（继承前作）
 *   新增/修改代码必须在旁边标注作者与意图：
 *     // 豆包添加：这段干嘛的
 *     // GPT添加：这段干嘛的
 *   改别人代码时，先注释「为什么改」再改。
 *
 * 【全局规则】
 *   1. 所有模块挂 window.WK，禁止散落全局变量/函数（onclick 一律走 WK.xxx）。
 *   2. 只有 WK.P 进 localStorage；函数、计时器、DOM 引用绝不进存档。
 *   3. 修改存档结构必须升 SAVE_VER，并在 save 模块补迁移逻辑。
 *
 * 【扩展地图（给后续 AI / GPT）】
 *   N2  主神内核：点数账本 / 手表倒计时 / 100米抹杀 / 扣分规则 / 任务与「记忆闪回」
 *   N3  地图：WK.ROOMS 全量房间 + 九宫格行走 + SVG 小地图（不要在本文件占位房上堆逻辑）
 *   N4  NPC：WK.NPCS 定义表 + 初始站位 + 交互菜单（本阶段不跟随、不移动）
 *   N5  怪物：WK.ENEMIES 母版表 + 刷新点（遭遇只打开数值面板，不战斗）
 *   N6  战斗引擎 + WK.SKILL_DEF 技能框架：
 *       - 技能类型 type 预留五大类，对应整本《无限恐怖》的兑换体系：
 *           'firearm' 科技·枪械（本集唯一实装的技能线，消耗体力 stamina）
 *           'magic'   魔法传说（道符/卷轴/护身符，消耗法力 mana，N13 后逐步开放）
 *           'martial' 武功（内力 neili，气功/内功/轻功线）
 *           'aux'     辅助（急救/解毒/隐身仪等，道具或主动技能）
 *           'mecha'   机甲/重装备（消耗能量 energy，后期副本）
 *       - 技能全部由 SKILL_DEF 数据表驱动（参考江湖版 SKILL_DEF 模式），
 *         战斗引擎只读通用字段（cost 资源类型/倍率/CD/效果钩子），不写死任何技能名。
 *       - 玩家资源槽在下方 newPlayer() 已预留：stamina / mana / neili / energy。
 *   N7  队友入队跟随（WK.P.party）
 *   N8  NPC 随剧情移动（stage 状态机驱动站位）
 *   N9  剧情事件管道（触发器/分支/QTE/限时/任务结算）
 *   N10-N12 正式剧情文案填充；N13 主神空间四大类兑换（科技/魔法传说/辅助/娱乐）
 *
 * 【原著数值锚点（不可改，张杰列车口述）】
 *   六维普通人均值 = 100（智力/精神力/细胞活力/神经反应速度/肌肉组织强度/免疫力）
 *   活过一部恐怖片基础奖励 1000 点；1 点 = 任意一维 +1
 *   杀 10 丧尸 = 1 点；杀 1 爬行者 = 100 点；杀 1 新人 = -1000 点
 *   回现实世界 = 50000 点；支线等级 S>A>B>C>D，1 个上级 = 3 个下级
 * ============================================================ */
window.WK = window.WK || {};
const WK = window.WK;
WK.VERSION = "v202-beta"; // v202：从v178彻底重做——主神空间动态认领体系+NPC房间互动+地下室训练场锁
  // ①【背包三分类】剧情道具 / 装备 / 道具 三个筛选页，共享同一个随身容量（RULES.carryBase 6→10，纳戒仍 +30）。
  //   ITEM_DEF 增加 bind 字段："world"=剧情道具(本世界武器/门禁卡/情报/本世界医疗品，回归主神自动收缴，卡片标注「不可带出本世界」)；
  //   "equip"=装备(兑换的武器防具，本集仅纳戒)；"item"=道具(兑换/可跨世界带走的消耗品与素材：T病毒原液/抗病毒血清/贵重品/红后核心)。
  // ②【支线剧情货币】P.branch{S,A,B,C,D}（字段早已预留，本版接上获取途径）。特殊素材在主神「其他→本世界素材回收」一次性兑换：
  //   T病毒原液→1000点+D支线；抗病毒血清→1000点+D支线；红后核心(新道具 core_redqueen，红后停机后主机核心舱拆出)→500点+C支线。
  //   仅每件终身一次（P.redeemed 记档）。原液/血清仍保留背包注射赌「弱化一阶基因锁」的用法，兑换或赌命由玩家自选。
  // ③【主神六选项卡】科技类 / 传说魔法类 / 辅助类 / 娱乐类 / 血统兑换 / 其他（严格六页）。属性强化/全身修复/素材回收/造人/队长权限项收进「其他」。
  //   科技/辅助先迁入已有兑换；传说魔法/娱乐/血统为带注释的数据骨架（SHOP.MAGIC/FUN/BLOODLINES 数组留空待大表填入）。
  // ④【主神造人】其他页可造人：首次免费、其后每次500点；自填名字/性别/六维模板(每项0~200)；造好的人在主神空间邀请入队后永久同行、可参战，
  //   战档由六维派生（WK.CREATED.allyOf）。另两个「回归之前恐怖片时间 / 回归现实时间」按 lon 要求置灰，需队长权限，本集不可点。
  // —— v141 N22 留档 ——
  WK._PREV_VERSION = "v217-beta";
  WK.VERSION = "v218-beta";
  // v141 N22【探索扩展包收官】测试面板章节直达 + 空房盘点（打磨为主，不改主线/不动数值平衡）：
  // ①【测试面板·章节直达】系统→测试工具新增「探索包·N15–N22 直达」组（仅 beta，正式发布随面板整块删）：
  //   kit 一键测试包(三权限卡/纳戒/补给/三贵重品/500点+回满)；gotoRouteChoice 关红后集结主机房看最后搜刮窗口/A·B抉择；
  //   gotoWarehouse B餐厅34箱(张杰在旁拦开箱)；gotoSecurity 安保·BOW三卡权限链/保险库/样本库；gotoKennel 犬舍刷丧尸犬；
  //   gotoDorm 宿舍搜刮；gotoFinalA 爬行者最终战(战死/归零都回主神)；gotoGodSpace 光球回收页+各系锁定展示。
  //   _prepFree/_land 统一备场（结束剧情/停下楼/拨到红后已关选路前态；手动置 stage，不走 goToStage 以免搬一堆 NPC）。
  // ②【空房盘点·用户口径"偶尔一两个即可"】全图125房审计：楼梯51层/站台/激光/下水道/主神为本就该空的剧情通道与战斗房；
  //   搜刮区里空着的是入口/走廊/枢纽/刷怪主厅(l_hall/l_junction/d_floor/k_entry/dorm_hall)与名场面注水研究间(l_tank_a/b 刷怪无货)、
  //   N21 留空的犬舍东跑道、B线管线竖井——空房已足够且各带氛围或风险，本版不再硬造，维持"偶尔一两个"的真实节奏。
  // ③ 不动经济/刷怪/补给数值（沿用 v139 平衡，留待 lon 实测后再调）。
  // —— v140 N21 留档 ——
  // v140 N21 搜刮×A/B分支门控+空房+旧功能回归（只做耦合与回归，不改主线）：
  // ①【B线折返漏洞修复】原封路阈值仅在已下井(depth≥2)生效，玩家选B被goto到维护终端(depth1)后仍能缩回主机房、
  //   反向穿激光通道回地上搜刮区。现 depth1 即封死回 core_room 的 W/N 路（专属文案 _bDither1：雇佣兵在井下催、
  //   郑吒詹岚顶死隔离门），depth≥2 维持焊死竖井(_bBackSealed)。→ 地上五大搜刮区(B餐厅/实验/安保/犬舍/宿舍/维护)
  //   在选 A(一镜死守) 或选 B(有进无退) 后永久不可达，只有 stage7 选路前那一个窗口能抢，决策有重量。
  // ②【点亮选路前搜刮窗口】n12_choice 集结旁白+god 明确：红后一关门全开怪全放，拍板前可自由折返搜刮，选路后没机会；
  //   不硬加读秒（尊重原著真实墙钟3小时，最终由 forceTimeUp 剧情归零），搜刮的代价是放出来的怪与血量，不是计时器。
  // ③【空房间·用户偏好】犬舍东跑道 k_run_b 移除补给架，改为刷丧尸犬却无任何可搜物的危险空房（死胡同/碎玻璃/爪印），
  //   连同 B线管线竖井 sw_pipe，偶尔一两个空房增加真实感，不再每间塞满。
  // ④ Playwright 旧功能回归：选路窗口反向遍历五区双向通路/红后锁全开/激光通道反穿、回主机房马修张杰选路按钮、
  //   B线 depth1+depth2 封路、A线一镜到底、三片后勤刷怪 gate、新档/旧档迁移、重生者快进；shot.py 零 console 错。
  // （历史：v139 N20 战斗道具栏四件数据驱动/即时用药不耗集气/贵重品三类/主神回收页/纳戒描述修复；
  //   v138 N19 丧尸犬与犬舍/宿舍/维护三片后勤区；v133-v137 物件系统/钥匙链/手雷进战斗/餐饮仓储群/三级权限锁门群。）
  WK.STAGE   = "N14 · 完整版（第一集「名为生化」）";


/* ===== 存档模块 + 玩家数据结构 ===== */
  /* ============================================================
   * 一、存档模块（localStorage）
   * ============================================================ */
  const SAVE_VER = 1;          // 豆包添加：存档结构版本，改 newPlayer 结构时 +1 并写迁移
  /* 豆包v166：三档手动存档。每个槽独立 localStorage key；当前正在游玩的槽记在 cur-slot。
     write()/read()/exists()/clear() 不带参数时一律作用于「当前槽」，旧调用点无需改动。
     旧的单档 wuxian_save_v1 在启动时由 migrateLegacy() 一次性并入 1 号槽。 */
  const SAVE_SLOT_COUNT = 3;
  const LEGACY_SAVE_KEY = "wuxian_save_v1";
  const CUR_SLOT_KEY = "wuxian_save_cur_slot";

  WK.save = {
    slot: 1,
    SAVE_SLOT_COUNT: SAVE_SLOT_COUNT,
    _key(slot) { return "wuxian_save_v1_s" + (slot || this.slot || 1); },
    setSlot(slot) {
      slot = parseInt(slot, 10);
      if (!(slot >= 1 && slot <= SAVE_SLOT_COUNT)) slot = 1;
      this.slot = slot;
      try { localStorage.setItem(CUR_SLOT_KEY, String(slot)); } catch (e) {}
    },
    getSlot() {
      try { const v = parseInt(localStorage.getItem(CUR_SLOT_KEY), 10); return (v >= 1 && v <= SAVE_SLOT_COUNT) ? v : 1; }
      catch (e) { return 1; }
    },
    write() {
      if (!WK.P) return;
      const data = { v: SAVE_VER, savedAt: Date.now(), slot: this.slot, P: WK.P };
      try { localStorage.setItem(this._key(), JSON.stringify(data)); }
      catch (e) { WK.log("sys", "存档失败：" + e.message); }
    },
    read(slot) {
      slot = slot || this.slot;
      try {
        const raw = localStorage.getItem(this._key(slot));
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || data.v !== SAVE_VER) return null; // 大版本不符直接弃档
        data.P = migratePlayer(data.P);
        return data;
      } catch (e) { return null; }
    },
    exists(slot) { return !!this.peek(slot).exists; },
    anyExists() { return this.listSlots().some(s => s.exists); },
    clear(slot) { localStorage.removeItem(this._key(slot)); },
    /* 只读元信息用于选档界面，不迁移、不挂全局 P；坏档给 broken 标记 */
    peek(slot) {
      slot = slot || this.slot;
      try {
        const raw = localStorage.getItem(this._key(slot));
        if (!raw) return { slot: slot, exists: false };
        const d = JSON.parse(raw);
        if (!d || d.v !== SAVE_VER || !d.P) return { slot: slot, exists: false, broken: true };
        const P = d.P;
        return { slot: slot, exists: true, savedAt: d.savedAt, name: P.name, stage: P.stage,
          location: P.location, hp: P.hp, maxHp: P.maxHp, dead: !!P.dead, reborn: !!P.reborn };
      } catch (e) { return { slot: slot, exists: false, broken: true }; }
    },
    listSlots() { const arr = []; for (let i = 1; i <= SAVE_SLOT_COUNT; i++) arr.push(this.peek(i)); return arr; },
    saveTo(slot) { this.setSlot(slot); this.write(); },
    loadFrom(slot) {
      const data = this.read(slot);
      if (!data) return false;
      this.setSlot(slot);
      WK.P = data.P;
      WK.enterWorld(true);
      return true;
    },
    deleteSlot(slot) { localStorage.removeItem(this._key(slot)); },
    /* 旧单档（v165 及以前）首次启动并入 1 号槽；三槽已有任何一档则不动 */
    migrateLegacy() {
      try {
        if ([1, 2, 3].some(i => !!localStorage.getItem(this._key(i)))) return false;
        const raw = localStorage.getItem(LEGACY_SAVE_KEY);
        if (!raw) return false;
        const d = JSON.parse(raw);
        if (!d || d.v !== SAVE_VER || !d.P) return false;
        localStorage.setItem(this._key(1), raw);
        localStorage.removeItem(LEGACY_SAVE_KEY);
        return true;
      } catch (e) { return false; }
    }
  };
  WK.save.slot = WK.save.getSlot();

  /* 豆包N2：同 SAVE_VER 内的温和迁移——新阶段给玩家对象加字段时在这里补默认值，
   * 已有的字段一律不动，避免老存档读崩。大结构删改才升 SAVE_VER。 */
  function migratePlayer(p) {
    const base = newPlayer(p && p.name ? p.name : "无名");
    p.ledger  = p.ledger  || base.ledger;
    p.watch   = Object.assign(base.watch, p.watch || {});
    p.anchor  = Object.assign(base.anchor, p.anchor || {});
    p.quests  = Array.isArray(p.quests) ? p.quests : [];
    // 豆包N2：kills 补 zombiePaid（丧尸群折算点数基准）
    p.kills = Object.assign({ zombie:0, dog:0, crawler:0, rookie:0, zombiePaid:0, dogPaid:0 }, p.kills || {});
    // 豆包N3：地图探索字段；N1/N2 测试档的占位 office 房间映射到列车起点
    p.visitedRooms = p.visitedRooms || base.visitedRooms;
    if (!p.location || p.location === "office") p.location = "ti_a";
    p._lastDir = p._lastDir || null;
    if (typeof p.dead !== "boolean") p.dead = false;
    // 豆包N4：NPC 动态状态——老档整体缺失则补默认，逐个 NPC 缺失则补单个（保留已移动/死亡状态）
    if (!p.npcs) p.npcs = base.npcs;
    else Object.keys(base.npcs).forEach(id => { if (!p.npcs[id]) p.npcs[id] = base.npcs[id]; });
    // 豆包N5：刷怪冷却表
    p.spawns = p.spawns || {};
    // 豆包v128/v129：关键道具与场景物件状态（温和补默认，不升 SAVE_VER）
    p.items = Object.assign({ antiviral:0, tvirus:0 }, p.items || {});
    p.objState = p.objState || {};
    // 豆包v140（N21 旧档回归）：N5 之后引入、更早的本地档可能整体缺失的字段，缺失才补、已有一律不动，
    // 否则读到 P.party.has / P.favor / P.skills / P.res 会是 undefined 直接崩。
    p.skills = p.skills || {};
    p.party  = Array.isArray(p.party) ? p.party : [];
    p.created = Array.isArray(p.created) ? p.created : [];   // 豆包v142：主神造人
    p.redeemed = p.redeemed || {};                          // 豆包v142：特殊素材一次性兑换
    p.equip = Object.assign({ weapon:null, armor:null, accessory:null, ring:null }, p.equip || {});
    if (p.bloodline === undefined) p.bloodline = null;
    p.favor  = p.favor || {};
    p.flags  = p.flags || {};
    p.stats  = Object.assign({ headshots:0, qteWin:0, qteLose:0, plotChanged:0 }, p.stats || {});
    p.res    = p.res || base.res;
    if (typeof p.hp !== "number") p.hp = base.maxHp || 100;
    if (typeof p.stage !== "number") p.stage = 0;
    if (typeof p.gameTime !== "number") p.gameTime = 0;
    return p;
  }
  WK.migratePlayer = migratePlayer;
  // 旧档补 geneLock 字段
  (function(){
    const _m = WK.migratePlayer;
    WK.migratePlayer = function(p){
      p = _m ? _m(p) : p;
      if (p && !p.geneLock && WK.GeneLock) WK.GeneLock.ensure(p);
      return p;
    };
  })();
  // v162：读档后启动非战斗能量回复
  setTimeout(function(){ if (WK.Blood && WK.Blood.startPassiveRegen) WK.Blood.startPassiveRegen(); }, 800);

  /* ============================================================
   * 二、玩家数据结构
   * 注意：字段即为存档结构，新增字段给默认值，删除字段需升 SAVE_VER
   * ============================================================ */
  function newPlayer(name, reborn) {
    return {
      name: name || "无名",     // 豆包v118：未取名的玩家，剧情里一律自称「无名」
      location: "ti_a",            // 豆包N3：起点=行驶列车·苏醒车厢（N10 正式苏醒剧情）
      visitedRooms: { ti_a: true },// 豆包N3：已探索房间（小地图据此显示名字，否则显示？？？）
      _lastDir: null,              // 豆包N3：上次移动方向，驱动方位图进场动画

      // —— 生命与战斗资源（N6 战斗引擎读取；后三个槽为全书技能体系预留，本集只用 stamina）——
      hp: 100, maxHp: 100,
      res: {
        stamina: 60, maxStamina: 60,   // 体力：枪械战术动作（翻滚/瞄准/急救）消耗
        mana:    0,  maxMana: 0,       // 法力：魔法传说类（N13 之后的副本才可能出现）
        neili:   0,  maxNeili: 0,      // 内力：武功类（中国气功等，需支线兑换）
        energy:  0,  maxEnergy: 0      // 能量：机甲/重装备类（后期）
      },

      // —— 原著六维属性，普通人均值 100；1 奖励点可兑换 1 点（N13 实装兑换）——
      attrs: { int:100, spi:100, cel:100, ner:100, mus:100, imm:100 },
      geneLock: { opensTotal:0, active:false, openedThisBattle:false, activeUntil:0, penaltyUntil:0, penaltyPct:0, backlashUntil:0, backlashLastTick:0, _lastCheck:0 },

      // —— 主神账本（N2 接入变动逻辑，N1 只建字段）——
      points: 0,                   // 奖励点数（可为负，本集结束仍为负 → 抹杀）
      branch: { S:0, A:0, B:0, C:0, D:0 },  // 恐怖支线剧情次数
      kills: { zombie:0, dog:0, crawler:0, rookie:0, zombiePaid:0, dogPaid:0 }, // zombiePaid/dogPaid：丧尸/丧尸犬已折算点数（底层仍是每10只1点）
      ledger: [],                  // 豆包N2：点数逐笔流水 {n, reason, t}，N13 结算逐笔列账

      // —— 豆包N2：手表倒计时（真实墙钟，跨刷新继续走；主神的时间不会暂停）——
      watch: {
        running: false, ended: false,
        startAt: 0,               // Date.now()
        durationMs: 0,            // 本次倒计时总时长
        rewarded: false           // 存活基础奖励是否已发放
      },

      // —— 豆包N2：锚点人物 100 米规则（N7 楼梯系统驱动距离，N2 手动测试）——
      anchor: { active:false, name:"", distance:0 },

      // —— 豆包N2：任务表 {id,type:'main'/'side',title,state:'active'/'done'/'failed'} ——
      quests: [],
      dead: false,                 // 豆包N2：被抹杀标记（死档清除，仅流程用）

      // —— 背包 / 技能 / 队友（N5/N6/N7 填充）——
      bag: [],                     // 物品名数组，堆叠数量 N5 物品系统再细化
      // 豆包v128：关键剧情道具（带数量、可在背包主动使用）。antiviral=抗病毒血清，tvirus=T病毒原液
      items: { antiviral:0, tvirus:0 },
      objState: {},               // 豆包v129：场景物件状态 { "房:id": "done" | {remain:[{id,n}]} }，随存档
      skills: {},                  // { 技能名: {level, exp, type, tier} }，结构对齐未来 SKILL_DEF
      party: [],                   // 已入队 NPC id 数组（N7）
      created: [],                 // 豆包v142：主神造人列表 [{id,name,gender,attrs:{六维},t}]，可在主神空间邀请入队、永久同行
      redeemed: {},                // 豆包v142：特殊素材终身一次性兑换记录 { 物品id:true }（T病毒原液/血清/红后核心）

      // —— 豆包v143：装备槽 + 血统（主神兑换落地）——
      // weapon/armor/accessory/ring 存 ITEM_DEF 的 id 或 null；战斗读 WK.combat.stats()
      equip: { weapon:null, armor:null, accessory:null, ring:null },
      // bloodline: 模板类兑换结果；null=凡人。energyType 对应 res 槽，traits 为特征 id 列表
      bloodline: null,             // { id, name, energyType, bodyPts, traits:[] }

      // —— 剧情状态（N8/N9 驱动）——
      stage: 0,                    // 主线阶段号（列车=0 … 终局，N8 定义枚举）
      flags: { reborn: !!reborn }, // 豆包v125：重生者=剧情快进模式（只停选项窗，正文快速带过）；其余剧情开关动态挂这里
      favor: {},                   // NPC 好感度（N4 起用；v125 作为郑吒/詹岚入队门槛）
      npcs: WK.initNpcStates(),    // 豆包N4：NPC 动态状态 {id:{loc,alive,met}}（home/全活/未见）
      spawns: {},                  // 豆包N5：各遭遇点清场冷却 {roomId:{lastClear,cooldownUntil}}（N6 战斗读）
      evDone: {},                 // 豆包N9：一次性剧情事件完成记录 {eventId:true}
      gameTime: 0,                 // 游戏内经过分钟数（N2 倒计时系统使用）

      // —— 统计（结算页展示用）——
      stats: { headshots:0, qteWin:0, qteLose:0, plotChanged:0 }
    };
  }
  WK.newPlayer = newPlayer;
  WK.P = null;

  /* 豆包v118：玩家名统一入口。未取名 / 旧档默认「新人」一律按「无名」对待，供剧情 {name} 占位使用 */
  WK.playerName = function () {
    const n = (WK.P && WK.P.name ? String(WK.P.name) : "").trim();
    return (!n || n === "新人") ? "无名" : n;
  };


/* ===== 日志 + 规则内核 + 道具 + 背包 + 记忆闪回 ===== */
  /* ============================================================
   * 四、日志与浮动提示（全局唯一日志 DOM）
   * ============================================================ */
  WK.log = function (cls, msg) {
    const el = document.getElementById("log-area");
    if (!el) return;
    const d = document.createElement("div");
    d.className = "l " + (cls || "sys");
    d.textContent = msg;
    el.appendChild(d);
    el.scrollTop = el.scrollHeight;
  };

  WK.toast = function (msg, type, dur) {
    const layer = document.getElementById("float-layer");
    const t = document.createElement("div");
    t.className = "float-toast " + (type || "");
    t.textContent = msg;
    layer.appendChild(t);
    setTimeout(() => t.remove(), dur || 1700);
  };

  /* ============================================================
   * 豆包N2：主神规则内核
   * 所有数字均为原著锚点（张杰列车口述），除 testWatchMs 外禁止随意改。
   * ============================================================ */
  WK.RULES = {
    watchMinutes: 180,      // 正式存活时长 3 小时
    testWatchMs: 15 * 1000, // N2 验收用 15 秒；N14 删测试入口后统一走 watchMinutes
    anchorLimit: 100,       // 离开锚点剧情人物 100 米 → 抹杀
    zombiePerPoint: 10,     // 原著口径：每 10 只丧尸 = 1 点（N6 一场群战约 10 只，清场即 +1，不让玩家一只只刷）
    crawlerPoint: 100,      // 每只爬行者 = 100 点
    rookiePoint: -1000,     // 杀 1 名新人 = -1000 点
    swearPenalty: -10,      // 剧情人物能听到时，提主神/奖励点每句 -10
    baseReward: 1000,       // 活过一部恐怖片基础奖励
    /* —— 豆包v116：下楼梯段「大部队行进」节奏（lon 要求：马修队真的在下楼，站着不动会被甩开）—— */
    squadStepMs: 1000,          // 大部队每 1 秒向下走一层
    stairMetersPerFloor: 3,     // 每落后一层折算 3 米；脱离马修 100 米抹杀（约 34 层、原地 34 秒即死）
    /* —— 豆包v120：下楼搀扶（lon 要求：4 选 1，拉人每层只追回 1 米；小胖/妇女每 3 层要歇一次）——
       锚点距离做成独立「拉扯距离」累加器（不再等于楼层差）：
       · 大部队每过 1 秒（下一层），距离 +3 米，不管你点没点；
       · 你每点一次「下楼」，独自走追回 3 米，搀着人只追回 1 米（下限 0）；
       · 小胖/妇女每下 3 层弹「走不动了」，弹窗时你点不了下楼、大部队却照常拉开 → 救人真正的难点。
       净效果：想把人拽到底，必须持续狂点 + 秒处理弹窗，在 100 米内下完，否则同归于尽。 */
    assistCatchPerFloor: 1,     // 搀扶时每下一层只追回 1 米（独自下是 3 米）
    assistRestEvery: 3,         // 小胖/中年妇女：每搀扶下 3 层触发一次「走不动了，要歇息」弹窗

    /* —— 豆包v124：脱战自动回血（玩法平衡常量，非原著锚点，可按手感调）——
       lon 反馈：连续战斗之间没有回血手段、容易一路被磨死。故脱战（不在 ATB 战斗中）时
       每秒按最大生命的比例缓慢回血；战斗中不回，保留紧张感（战斗内回复仍靠技能/药剂）。
       0.01 = 每秒回 1% 最大生命，maxHp 100 时约 100 秒从空回满，相邻两场战斗间能缓过来。*/
    hpRegenPerSec: 0.01,

    /* —— 豆包v128：T 病毒原液 + 抗病毒血清 · 赌命撞基因锁（楚轩式捷径，数值非原著锚点，可按手感调）——
       流程：背包注射 1 支 T 病毒原液（主动感染、置 tVirusPrimed）→ 立刻再用 1 支血清收束 →
       按 geneLockChance 判定：成功＝拿到「一阶基因锁·弱化」永久小幅强化；失败＝血清压下病毒、人活但重伤。
       与「正常在生死间顿悟的一阶」相比，弱化版只给常驻小属性、没有战斗爆发技（爆发接口留给后续技能系统）。*/
    geneLockChance: 0.5,       // 注射后成功撞开弱化一阶的概率
    geneLockAttrs: { ner:15, mus:15, cel:15, imm:10 },  // 成功后六维提升（神经/肌肉/细胞活力/免疫）
    geneLockMaxHp: 15,         // 成功后生命上限提升

    /* —— 豆包v132：B餐厅冷冻集装箱（红后关后逐箱开启）——
       第一部刻意「稳定一点」（lon 拍板）：开箱只以较低概率放出 1 只爬行者，其余为空箱/冻尸或一点普通物资；
       出爬行者时战斗引擎按 rules.kill('crawler') 结算 +100 奖励点。N17 扩展更多仓储房间时在此统一调参。*/
    crateCrawlerChance: 0.25,  // 单箱开出爬行者的概率（其余中 55% 空/冻尸、45% 普通消耗品）

    /* —— 豆包v135 N16③：战斗内投掷物 ——
       手雷不耗集气/体力，投掷即生效，仅消耗背包数量（frag bulk2、携带量天然受限）。
       fragDamage：对普通丧尸「群血池」一次性造成的范围伤害（丧尸 40 血/只，约能炸翻 3 只/组）；
       fragBossMult：对爬行者这类单体重甲 BOSS 的伤害系数（爆炸有一定穿甲，但不保证秒杀）。*/
    fragDamage: 120,
    fragBossMult: 0.6,

    /* —— 豆包v129：随身容量（lon：一个人只能拿一点点，想多带就去主神兑换「纳戒」等空间装备）——
       只统计「占格」消耗品（bulk≥1）；关键道具/药剂/钥匙/文件（bulk=0）随身暗袋携带，不占格。
       第一部刻意给得很紧：基础 6 格，逼玩家取舍；纳戒 +30 格（见 ITEM_DEF ring_naring）。*/
    carryBase: 10,   // 豆包v142：随身总容量 6→10（背包三分类共享这一个体积；纳戒 ringBonus 另加）
    ringBonus: 200,  // 纳戒≈空间戒指 1m³：约 +200 格（对格数制近乎无限）

    createCost: 500  // 豆包v142：主神造人——首次免费，其后每造一人 500 奖励点
  };

  let watchTimer = null;

  /* ============================================================
   * 豆包v129：道具表 WK.ITEM_DEF + 随身容量 WK.inv
   * 所有可堆叠道具统一存 P.items = { id: 数量 }（关键剧情药剂也在里面）。
   * bulk = 占格体积；0 = 关键道具（药剂/钥匙/文件/空间装备），走暗袋不占容量。
   * 后续 N16/N19 只往 ITEM_DEF 里加条目即可，背包与容量自动生效。
   * ============================================================ */
  /* bind 三分类（豆包v142）：
     · "world" 剧情道具——本世界武器/门禁卡/情报/本世界医疗品，【不可带出本世界】，回归主神自动从背包收缴；
     · "equip" 装备——主神兑换、可跨世界带走的武器防具（本集仅纳戒）；
     · "item"  道具——可跨世界带走的兑换消耗品 / 特殊素材（T病毒原液、抗病毒血清、贵重品、红后核心）。
     容量仍只看 bulk>0；bind 只决定背包分类页与回归是否收缴。 */
  WK.ITEM_DEF = {
    // —— 可跨世界带走的特殊素材 / 兑换品（bulk 0，不占格；bind:"item"）——
    tvirus:    { name:"T 病毒原液", bulk:0, kind:"key", bind:"item", desc:"主动感染。注射后须立刻用一支抗病毒血清收束，赌命撞「一阶基因锁·弱化」；也可带回主神空间兑换成奖励点与 D 级支线（终身仅一次）。" },
    antiviral: { name:"抗病毒血清", bulk:0, kind:"key", bind:"item", desc:"被 T 病毒感染后约十分钟内注射可救命；也是收束原液、冲击基因锁的另一半。带回主神空间亦可兑换奖励点与 D 级支线（终身仅一次）。" },
    core_redqueen:{ name:"红后核心存储器", bulk:0, kind:"material", bind:"item", desc:"从火焰女皇主机上强行拆出的核心存储模块，触手尚有余温，里面封存着蜂房 AI 的底层密钥与全套 BOW 数据。这种规格的 AI 核心，主神愿意出高价并记一笔 C 级支线剧情。" },
    ring_naring:{ name:"纳戒", bulk:0, kind:"equip", bind:"equip", slot:"ring", stats:{ }, desc:"主神空间兑换的空间装备，内含约一立方米独立空间。随身容量 +" + (typeof WK!=="undefined"&&WK.RULES?WK.RULES.ringBonus:30) + " 格（被动，拥有即生效，装入戒指槽）。" },
    /* 豆包v143：可装备武器（主神兑换写入背包后可装入武器槽；数值进入 WK.combat）*/
    eq_mauser:{ name:"毛瑟手枪", bulk:1, kind:"weapon", bind:"equip", slot:"weapon", type:"firearm", wepType:"ranged",
      stats:{atk:5, dmgMin:6, dmgMax:14, hit:0.05, crit:0.04},
      desc:"【远程·枪】伤害 8–22（神经/肌肉越高越贴近上限）。命中+4% 暴击+3%。集气≈换弹节奏。" },
    eq_glock:{ name:"格洛克17", bulk:1, kind:"weapon", bind:"equip", slot:"weapon", type:"firearm", wepType:"ranged",
      stats:{atk:8, dmgMin:10, dmgMax:24, hit:0.07, crit:0.05},
      desc:"【远程·枪】伤害 10–26。命中+6% 暴击+4%。" },
    eq_deagle:{ name:"沙漠之鹰", bulk:1, kind:"weapon", bind:"equip", slot:"weapon", type:"firearm", wepType:"ranged",
      stats:{atk:12, dmgMin:16, dmgMax:38, hit:0.03, crit:0.09},
      desc:"【远程·枪】伤害 16–38。命中+2% 暴击+8%。后坐力大，上限高。" },
    eq_knife:{ name:"军用匕首", bulk:1, kind:"weapon", bind:"equip", slot:"weapon", wepType:"melee",
      stats:{atk:6, hit:0.03, crit:0.05},
      desc:"【近战】基础攻击+5，命中+3% 暴击+5%。集气吃六维综合。" },
    eq_machete:{ name:"军用开山刀", bulk:1, kind:"weapon", bind:"equip", slot:"weapon", wepType:"melee",
      stats:{ atk:9, hit:0.01, crit:0.04 },
      desc:"【近战】基础攻击+9，命中+1% 暴击+4%。" },
    eq_vest:{ name:"防弹衣", bulk:1, kind:"armor", bind:"equip", slot:"armor",
      stats:{ armor:3, maxHp:5 }, desc:"普通防弹衣。护甲+3，生命上限+5。" },
    eq_vest_plus:{ name:"新式防弹背心", bulk:1, kind:"armor", bind:"equip", slot:"armor",
      stats:{ armor:5, maxHp:10 }, desc:"更优防弹。护甲+5，生命上限+10。" },
    /* 特殊弹药：背包持有即对所有枪械生效（不消耗数量，作「已兑换弹药许可」）*/
    ammo_spirit:{ name:"灵类子弹", bulk:0, kind:"ammo", bind:"item", ammoTag:"spirit",
      desc:"【弹药修正】持有时所有枪械普攻视为灵弹：对灵体有效，命中略升。不区分枪型。" },
    ammo_silver:{ name:"硝酸银子弹", bulk:0, kind:"ammo", bind:"item", ammoTag:"silver",
      desc:"【弹药修正】持有时全体枪械暴击率小幅提升，对特定生物更有效。" },
    ammo_fire:{ name:"燃烧子弹", bulk:0, kind:"ammo", bind:"item", ammoTag:"fire",
      desc:"【弹药修正】持有时全体枪械伤害上限 +8%。" },
    ammo_holy:{ name:"神圣子弹", bulk:0, kind:"ammo", bind:"item", ammoTag:"holy",
      desc:"【弹药修正】持有时全体枪械伤害上限 +12%、暴击+4%，对邪恶生物特效。" },
    arrow_ench_1:{ name:"附魔+1箭", bulk:0, kind:"ammo", bind:"item",
      desc:"【箭矢修正】持有时所有弓伤害与暴击按 +1 附魔结算。" },
    /* —— 豆包v145：科技类第一批（原著价位锚点，数值供战斗 rollAttack）—— */
    eq_usp:{ name:"USP手枪", bulk:1, kind:"weapon", bind:"equip", slot:"weapon", type:"firearm", wepType:"ranged",
      stats:{atk:8, dmgMin:10, dmgMax:24, hit:0.07, crit:0.05},
      desc:"【远程·枪】伤害 10–24。命中+7% 暴击+5%。精准现代手枪。" },
    eq_uzi:{ name:"乌兹微型冲锋枪", bulk:1, kind:"weapon", bind:"equip", slot:"weapon", type:"firearm", wepType:"ranged",
      stats:{atk:7, dmgMin:8, dmgMax:20, hit:0.05, crit:0.04},
      desc:"【远程·枪】伤害 8–20。射速取向，单发伤害一般，适合近距离倾泻。" },
    eq_mp7:{ name:"MP7", bulk:1, kind:"weapon", bind:"equip", slot:"weapon", type:"firearm", wepType:"ranged",
      stats:{atk:10, dmgMin:12, dmgMax:28, hit:0.06, crit:0.04},
      desc:"【远程·枪】伤害 11–25。命中+8%。低后坐、高稳定性冲锋枪。" },
    eq_m4:{ name:"M4A1卡宾枪", bulk:1, kind:"weapon", bind:"equip", slot:"weapon", type:"firearm", wepType:"ranged",
      stats:{atk:14, dmgMin:16, dmgMax:36, hit:0.07, crit:0.06},
      desc:"【远程·枪】伤害 14–32。综合性能优秀的突击步枪。" },
    eq_type95:{ name:"95式突击步枪", bulk:1, kind:"weapon", bind:"equip", slot:"weapon", type:"firearm", wepType:"ranged",
      stats:{atk:13, dmgMin:15, dmgMax:34, hit:0.07, crit:0.05},
      desc:"【远程·枪】伤害 13–30。国产无托小口径，精度高、重量轻。" },
    eq_m870:{ name:"雷明顿M870霰弹枪", bulk:1, kind:"weapon", bind:"equip", slot:"weapon", type:"firearm", wepType:"ranged",
      stats:{atk:18, dmgMin:20, dmgMax:48, hit:0.0, crit:0.03},
      desc:"【远程·枪】伤害 18–42。近距离威力大，命中不加成（靠散布）。" },
    eq_barrett:{ name:"巴雷特M82A1", bulk:2, kind:"weapon", bind:"equip", slot:"weapon", type:"firearm", wepType:"ranged",
      stats:{atk:22, dmgMin:28, dmgMax:58, hit:0.06, crit:0.15},
      desc:"【远程·狙击】伤害 28–55。反器材级威力，暴击+12%。占 2 格。" },
    eq_helmet:{ name:"防弹头盔", bulk:1, kind:"armor", bind:"equip", slot:"accessory",
      stats:{ armor:2, maxHp:3 },
      desc:"【防具·头】护甲+2 生命上限+3。装在饰品槽。" },
    eq_boots:{ name:"特种作战靴", bulk:1, kind:"armor", bind:"equip", slot:"accessory",
      stats:{ chargeSpd:0.05, maxHp:2 },
      desc:"【防具·靴】集气速度+5% 生命上限+2。装在饰品槽。" },
    eq_combat_vest:{ name:"特种作战衣", bulk:1, kind:"armor", bind:"equip", slot:"armor",
      stats:{ armor:4, maxHp:8 },
      desc:"【防具】护甲+4 生命上限+8。迷彩防弹，口袋较多。" },

    // —— 剧情道具·权限卡（bulk 0 不占格、不可丢弃、不可带出本世界）——
    keycard_l1:{ name:"一级安保卡", bulk:0, kind:"key", bind:"world", desc:"保护伞普通安保的白色门禁卡，卡面一道杠。能开一道杠的刷卡门与基础安保柜，权限在关闭红后后依旧有效。【不可带出本世界】" },
    keycard_l2:{ name:"二级安保卡", bulk:0, kind:"key", bind:"world", desc:"主管级金卡，两道杠。覆盖一级权限，并能开启高级武器柜与管制内间。蜂房里没几张。【不可带出本世界】" },
    keycard_l3:{ name:"三级安保卡", bulk:0, kind:"key", bind:"world", desc:"安保主任的黑色权限卡，三道杠。蜂房现场最高门禁等级，能开启管制保险库与主任样本库这种最深的房间。整张蜂房恐怕只有一张。【不可带出本世界】" },
    // —— 剧情道具·本世界消耗品（占格；回归主神收缴）——
    medspray:  { name:"急救喷雾", bulk:1, kind:"med", bind:"world", heal:{ hp:0.45 }, desc:"保护伞制式医疗喷雾，立即恢复约 45% 最大生命。战斗中可在技能栏上方道具栏直接使用。【不可带出本世界】" },
    bandage:   { name:"军用绷带", bulk:1, kind:"med", bind:"world", heal:{ hp:0.20 }, desc:"止血绷带，恢复约 20% 最大生命。战斗中可在道具栏快速包扎。【不可带出本世界】" },
    ration:    { name:"压缩口粮", bulk:1, kind:"food", bind:"world", battleUse:true, heal:{ sta:0.50 }, desc:"高热量军粮，恢复约 50% 体力。战斗中也能啃一口续上技能消耗。【不可带出本世界】" },
    frag:      { name:"破片手雷", bulk:2, kind:"battle", bind:"world", battleUse:true, desc:"军用破片手雷。战斗中在技能栏上方点「投掷」，不需集气，立即对全场敌人造成范围爆破伤害（对爬行者穿甲但伤害打折）。【不可带出本世界】" },
    // —— 可带回主神的贵重品（占 1 格；光球「其他→本世界素材回收」折算奖励点；value＝回收价）——
    val_watch:    { name:"名贵腕表", bulk:1, kind:"valuable", bind:"item", value:15, desc:"一块外壳冰凉的机械腕表，钻面在应急灯下反着光。对活下去没什么用，但主神会按它在现实世界的价值折算奖励点。" },
    val_jewelry:  { name:"铂金首饰盒", bulk:1, kind:"valuable", bind:"item", value:30, desc:"一只丝绒小盒，里面是成套的铂金首饰。蜂房高管的私产——带回主神光球可以回收成一笔不错的奖励点。" },
    val_data:     { name:"高管加密硬盘", bulk:1, kind:"valuable", bind:"item", value:40, desc:"一块贴着绝密标签的加密硬盘，里面是连红后都未必留底的 BOW 商业数据。对普通人毫无用处，主神却愿意为情报付高价。" },
    // —— 剧情道具·情报文件（bulk 0 不占格、不可丢弃、不可带出本世界；背包「阅读」打开 WK.DOCS）——
    doc_cargo:   { name:"冷冻货物运输清单", bulk:0, kind:"doc", bind:"world", doc:"doc_cargo", desc:"一份保护伞随车押运文件，记着 T 病毒样本与抗病毒血清的应急处置。【不可带出本世界】" },
    doc_tvirus:  { name:"T 病毒 · 研究备忘",   bulk:0, kind:"doc", bind:"world", doc:"doc_tvirus", desc:"研究员留下的项目备忘，写着 T 病毒的传播、转化时间与丧尸的弱点。【不可带出本世界】" },
    doc_licker:  { name:"BOW 项目 · 舔食者记录", bulk:0, kind:"doc", bind:"world", doc:"doc_licker", desc:"一份密级实验档案，记录封存在 B 餐厅的高阶变异体「舔食者」。【不可带出本世界】" },
    doc_redqueen:{ name:"火焰女皇 · 封锁规程",  bulk:0, kind:"doc", bind:"world", doc:"doc_redqueen", desc:"中央电脑的应急封锁系统日志，解释了今晚蜂房里发生的一切。【不可带出本世界】" }
  };
  /* 豆包v142：背包三分类归属统一入口（未来大表里新增道具只要在 ITEM_DEF 写 bind 即可自动归类；
     没写 bind 的旧物品按 kind 兜底：equip→装备页，valuable/material→道具页，其余→剧情道具页）。 */
  WK.invBindOf = function (id) {
    const d = WK.ITEM_DEF[id];
    if (!d) return "world";
    if (d.bind) return d.bind;
    if (d.kind === "equip") return "equip";
    if (d.kind === "valuable" || d.kind === "material") return "item";
    return "world";
  };
  // 纳戒扩容数值在 desc 里是动态的，这里补成真实常量（避免上面手写 0）
  WK.ITEM_DEF.ring_naring.desc = "主神空间兑换的空间装备，内含约一立方米独立空间。随身容量 +" +
    (WK.RULES.ringBonus) + " 格（被动，拥有即生效）。";

  /* ============================================================
   * 豆包v133：情报文件正文 WK.DOCS（背包「阅读」时弹出）
   * 内容只写《无限恐怖·名为生化》/《生化危机1》里确实出现的设定，不替玩家剧透未发生的分支；
   * 保护伞内部文档口吻为主，关键结论用金色标出，长文弹窗可上下滚动。
   * ============================================================ */
  WK.DOCS = {
    doc_cargo: {
      title:"冷冻货物运输清单",
      body:
        '<div style="color:var(--dim2);font-size:11.5px;letter-spacing:1px;margin-bottom:8px;">UMBRELLA · 蜂房专线 / 生物样本冷链押运单</div>' +
        '<div style="line-height:1.95;color:#c8d6c8;">' +
        '本车厢押运物（冷链温度 −20℃，全程不得断电）：<br>' +
        '· <span style="color:#8fd0c0;">T 病毒活性样本</span>若干（银灰冷藏盒，红色 BIOHAZARD 封条）；<br>' +
        '· <span style="color:#8fd0c0;">抗病毒血清（ANTI-VIRAL）</span>，数量极少，与样本同车，仅作暴露后的最后保障。<br><br>' +
        '纸角有一行匆忙写下的<span style="color:var(--gold);">手写批注</span>：' +
        '「一旦发生泄漏或被抓伤、咬伤，必须立刻注射抗病毒血清。暴露后的黄金救治窗口极短，' +
        '<span style="color:var(--gold);">大约只有十分钟</span>；等病毒和中枢神经结合完，血清就再没用了。」<br><br>' +
        '<span style="color:var(--dim);">清单末尾还盖着个戳：血清与原液配对押运，原则上不得分开使用。</span>' +
        '</div>'
    },
    doc_tvirus: {
      title:"T 病毒 · 研究备忘",
      body:
        '<div style="color:var(--dim2);font-size:11.5px;letter-spacing:1px;margin-bottom:8px;">PROJECT-T / 研究员私人备忘（已越权留档）</div>' +
        '<div style="line-height:1.95;color:#c8d6c8;">' +
        'T 病毒是公司押注的生化兵器核心：它能让<span style="color:#8fd0c0;">坏死的细胞重新活性化</span>，驱动一具本应死去的躯体重新站起来。' +
        '被它感染的人会丧失全部意识、记忆与思考，只剩一个最原始的本能——<span style="color:var(--gold);">吃</span>。<br><br>' +
        '<b>传播</b>：体液传染力极强，被咬伤、抓伤，甚至伤口黏膜接触到带毒血液都可能感染；' +
        '在封闭设施里，它还曾随空调循环系统扩散到每个角落。<br><br>' +
        '<b>过程</b>：暴露后短时间内是血清唯一能逆转的阶段；之后高热、意识崩坏，' +
        '<span style="color:var(--gold);">从暴露到完全转化大约半小时</span>。<br><br>' +
        '<b>怎么对付</b>：它们行动迟缓，普通子弹打进躯干大多只能让它晃一晃——' +
        '驱动那具身体的不再是生命，而是病毒。<span style="color:var(--gold);">只有彻底破坏颅脑，它才会真正停下来。瞄准头。</span>' +
        '</div>'
    },
    doc_licker: {
      title:"BOW 项目 · 舔食者记录",
      body:
        '<div style="color:var(--dim2);font-size:11.5px;letter-spacing:1px;margin-bottom:8px;">BOW / 阶段观察记录 / 密级：黑伞</div>' +
        '<div style="line-height:1.95;color:#c8d6c8;">' +
        '代号<span style="color:#8fd0c0;">「舔食者」</span>。与普通感染者不同，它是 T 病毒<span style="color:#8fd0c0;">不经死亡、直接在活体上</span>催出的高阶突变体，危险性高出普通丧尸何止百倍。<br><br>' +
        '· 体型数米，通体是贲张的赤红色肌肉；视觉器官完全退化，<span style="color:var(--gold);">没有眼睛</span>，' +
        '靠<span style="color:var(--gold);">红外热感应与嗅觉</span>锁定活物；<br>' +
        '· 舌头可弹出一米以上，前爪高度角质化、硬度堪比合金钢，' +
        '<span style="color:var(--gold);">能像撕纸一样撕开十厘米厚的钢板</span>；<br>' +
        '· 力量与速度远超人类，喜低温休眠。<br><br>' +
        '成体与半成品被装入低温冷冻集装箱，成排封存在代号<span style="color:#8fd0c0;">「B 餐厅」</span>的仓储大厅，' +
        '制冷与箱门锁全部由中央电脑直接管控。<br>' +
        '<span style="color:#e0a0a0;">警告：中央电脑一旦停机、制冷与电子锁同时解除，封存个体将在数分钟内复苏并主动猎杀。' +
        '轻武器几乎无法将其制止——见到红灯亮起、听见箱内抓挠声，唯一正确的动作是跑。</span>' +
        '</div>'
    },
    doc_redqueen: {
      title:"火焰女皇 · 封锁规程",
      body:
        '<div style="color:var(--dim2);font-size:11.5px;letter-spacing:1px;margin-bottom:8px;">QUEEN / 应急封锁规程（系统日志最后一条 · 已打印）</div>' +
        '<div style="line-height:1.95;color:#c8d6c8;">' +
        '<span style="color:#8fd0c0;">火焰女皇</span>是掌控整座蜂房的中央人工智能。它的最高优先级指令只有一条：' +
        '<span style="color:var(--gold);">不惜一切代价，阻止 T 病毒扩散到地表。</span>' +
        '一旦判定设施遭污染，它会把设施内一切可能携带病毒的生命体都列为清除对象。<br><br>' +
        '它在「污染判定」后依次执行：<br>' +
        '① 切断蜂房与外界的一切通讯；<br>' +
        '② 向空调系统释放神经性毒气，使人昏迷约四小时，苏醒后伴随<span style="color:#8fd0c0;">时间不定的记忆缺失</span>；<br>' +
        '③ 锁断电梯使其坠落，封死各分区安全门；<br>' +
        '④ 向低洼实验区注水、实施物理隔绝；<br>' +
        '⑤ 启用激光防御走廊，歼灭突破隔离的目标。<br><br>' +
        '<span style="color:#e0a0a0;">日志末尾的风险提示：若中央电脑被强行关闭，全部门禁、低温制冷与激光防御将在同一时刻失效——' +
        '被分隔开的感染体、以及冷冻封存的 BOW，会被一次性全部释放。执行关闭前，必须先确认撤离通道。</span>' +
        '</div>'
    }
  };

  /* 阅读情报文件（背包「阅读」按钮入口）*/
  WK.DOCS_OPEN = function (id){
    const doc = WK.DOCS[id] || WK.DOCS[(WK.ITEM_DEF[id] || {}).doc];
    if (!doc) { WK.toast("文件内容缺失","bad"); return; }
    WK.ui.generic(doc.title,
      '<div style="max-height:56vh;overflow-y:auto;padding-right:4px;">' + doc.body + '</div>' +
      '<button class="here-btn primary" style="width:100%;margin-top:14px;padding:11px;" onclick="WK.ui.closeOverlay(\'ov-generic\')">合上</button>');
  };

  WK.inv = {
    def(id){ return WK.ITEM_DEF[id]; },
    count(id){ return (WK.P.items && WK.P.items[id]) || 0; },
    /* 当前已占用格数（只算 bulk≥1 的消耗品）*/
    used(){
      const it = WK.P.items || {};
      let u = 0;
      Object.keys(it).forEach(id => {
        const d = WK.ITEM_DEF[id]; const n = it[id] || 0;
        if (d && d.bulk > 0 && n > 0) u += d.bulk * n;
      });
      return u;
    },
    cap(){
      let c = (WK.RULES.carryBase || 10);
      // 纳戒：1m³ 异次元，拥有即生效（约 +200 格）
      if (this.count("ring_naring") > 0) c += (WK.RULES.ringBonus || 200);
      // 已装备的空间戒/背包/空间袋等 carryBonus
      const p = WK.P;
      const eq = (p && p.equip) || {};
      Object.keys(eq).forEach(function (slot) {
        const id = eq[slot];
        if (!id) return;
        const d = WK.ITEM_DEF[id];
        if (d && d.stats && d.stats.carryBonus) c += d.stats.carryBonus;
      });
      // 未装备但在包内的「空间戒指/空间袋」——空间类拥有即扩容（与纳戒一致）
      const items = (p && p.items) || {};
      Object.keys(items).forEach(function (id) {
        if (!items[id]) return;
        if (eq && Object.keys(eq).some(function (s) { return eq[s] === id; })) return; // 已算装备
        const d = WK.ITEM_DEF[id];
        if (d && d.stats && d.stats.carryBonus && (d.stats.carryBonus >= 100 || (d.name && d.name.indexOf("空间") >= 0))) {
          c += d.stats.carryBonus;
        }
      });
      return c;
    },
    free(){ return this.cap() - this.used(); },
    /* 入包：bulk0 直接收；占格的按剩余容量塞，返回 {added,left}（left>0=背不动留在原处）*/
    add(id, n){
      n = n || 1;
      const d = WK.ITEM_DEF[id];
      const p = WK.P; p.items = p.items || {};
      if (!d) { p.items[id] = (p.items[id] || 0) + n; return { added:n, left:0 }; }
      if (!(d.bulk > 0)) { p.items[id] = (p.items[id] || 0) + n; return { added:n, left:0 }; }
      const can = Math.max(0, Math.floor(this.free() / d.bulk));
      const added = Math.min(n, can);
      if (added > 0) p.items[id] = (p.items[id] || 0) + added;
      return { added:added, left:n - added };
    },
    /* 豆包v170：主神兑换/剧情授予专用——无视当前容量强制入包（买就到手）。
       后果仍由玩家承担：像「一立方米X」(bulk 200) 入包后 used 远超 cap，
       背包标红、此后无法再拾取任何占格物，只能丢弃或用掉来减负。 */
    addForce(id, n){
      n = n || 1;
      const p = WK.P; p.items = p.items || {};
      p.items[id] = (p.items[id] || 0) + n;
      return { added:n, left:0 };
    },
    remove(id, n){
      n = n || 1;
      const p = WK.P; p.items = p.items || {};
      p.items[id] = Math.max(0, (p.items[id] || 0) - n);
    },
    /* 背包「使用」统一入口（返回 true 表示已处理）*/
    use(id){
      const p = WK.P;
      if (!this.count(id)) { WK.toast("没有这个道具", "bad"); return false; }
      if (id === "tvirus") return WK.Items.useTvirus();
      if (id === "antiviral") return WK.Items.useAntiviral();
      if (id === "ring_naring") {
        WK.ui.generic("纳戒", '<div style="line-height:1.9;color:#c8d6c8;">古铜色、毫不起眼的一枚戒指。戴上的瞬间，你「感觉」到身边多出一小块约一立方米的寂静空间——意念一动，物品便能存取。<br><span style="color:var(--gold);font-size:12.5px;">异次元约 1m³，随身容量 +' + WK.RULES.ringBonus + ' 格（近乎仓库）（已生效）。</span></div>' +
          '<button class="here-btn primary" style="width:100%;margin-top:14px;padding:11px;" onclick="WK.ui.closeOverlay(\'ov-generic\')">知道了</button>');
        return true;
      }
      const d = this.def(id);
      // 豆包v177：防御护符凝结耐久护盾（非战也可提前激发；一次性消耗、可充能常驻）
      if (d && d.shieldId) {
        const r = WK.Shield.activate(id);
        if (r.ok) { const sd = WK.ITEM_DEF[id]; if (sd && sd.consumable) WK.inv.remove(id, 1); WK.save.write(); }
        WK.toast(r.msg, r.ok ? "gold" : (r.status === "exists" ? "gold" : "bad"));
        if (WK.renderScene) WK.renderScene();
        return r.ok;
      }
      if (d && d.kind === "doc") return WK.DOCS_OPEN(id);
      if (id === "frag" || (d && d.kind === "throw")) { WK.toast("投掷物请在战斗中使用", "gold"); return false; }

      // —— 豆包v171：娱乐类道具（含天材地宝）非战统一走 WK.Fun ——
      // 必须排在「通用治疗满血就拦下」之前：天材地宝哪怕满血也能吃掉换永久属性（不白吃）。
      // 战斗中治疗类仍引导到下方战斗道具栏（_battleHeal 已接永久加点），非消耗型打完再享用。
      if (d && d.fun && WK.Fun) {
        if (WK.battle && WK.battle.state && WK.battle.state.active) {
          WK.toast((d.heal || d.battleUse) ? "战斗中请用下方战斗道具栏" : "战斗中没法安心享用，先打完再说", "gold");
          return false;
        }
        return WK.Fun.use(id);
      }

      // —— 豆包v172：辅助类药水/道具（复活/净化/法力/战斗增益…）非战走 WK.AuxItem ——
      if (d && d.auxItem && WK.AuxItem) {
        const inBattle = WK.battle && WK.battle.state && WK.battle.state.active;
        if (inBattle) { WK.toast((d.heal || d.battleUse) ? "战斗中请用下方战斗道具栏" : "战斗中没法用这个，先打完再说", "gold"); return false; }
        return WK.AuxItem.use(id);
      }

      // —— 目录道具：回血 / 能量 / buff / 复活（含 CD）——
      const st = d && d.stats;
      const isConsumable = d && (d.kind === "heal" || d.kind === "scroll" || d.consumable ||
        (st && (st.heal != null || st.energy != null || st.revive || st.buff)));
      if (isConsumable && st) {
        p.itemCd = p.itemCd || {};
        const group = st.cdGroup || (st.heal != null ? "heal" : st.energy != null ? "energy" : st.revive ? "revive" : "item");
        const now = Date.now();
        const until = p.itemCd[group] || 0;
        if (now < until) {
          const left = Math.ceil((until - now) / 1000);
          WK.toast("此类道具冷却中（" + left + " 秒）", "bad");
          return false;
        }
        // 战斗中也允许用药，但走同一 CD（防止 20 点喷雾无限刷）
        let msg = [], gained = false;
        if (st.heal != null) {
          const before = p.hp, add = st.heal, after = Math.min(p.maxHp || 100, before + add);
          const real = after - before;
          if (real >= 1) { p.hp = after; msg.push("生命 +" + Math.round(real)); gained = true; }
        }
        if (st.energy != null && p.res) {
          // 能量：优先 stamina，其次任意资源池
          const key = p.res.maxStamina != null ? "stamina" : null;
          if (key) {
            const before = p.res[key] || 0, max = p.res.maxStamina || 60;
            const after = Math.min(max, before + st.energy);
            const real = after - before;
            if (real >= 1) { p.res[key] = after; msg.push("体力 +" + Math.round(real)); gained = true; }
          } else {
            gained = true;
            msg.push("能量 +" + st.energy);
          }
        }
        if (st.revive) {
          if (p.dead || (p.hp || 0) <= 0) {
            p.dead = false;
            p.hp = Math.max(1, Math.round((p.maxHp || 100) * ((st.reviveHpPct || 20) / 100)));
            msg.push("复活（生命 " + (st.reviveHpPct || 20) + "%）");
            gained = true;
          } else if (st.windowSec) {
            p.flags = p.flags || {};
            p.flags.reviveWindowUntil = now + st.windowSec * 1000;
            p.flags.reviveWindowPct = st.reviveHpPct || 20;
            msg.push("已挂上重生（" + Math.round(st.windowSec / 60) + " 分钟内阵亡可自动复活）");
            gained = true;
          } else {
            WK.toast("当前无需复活", "good");
            return false;
          }
        }
        if (st.buff) {
          p.buffs = p.buffs || {};
          const dur = (st.durationSec || 10) * 1000;
          if (st.invuln) p.buffs.invulnUntil = now + dur;
          if (st.magicImmune) p.buffs.magicImmuneUntil = now + dur;
          if (st.luck) p.buffs.luck = { v: st.luck, until: now + dur };
          if (st.cleanse) { p.flags = p.flags || {}; p.flags.infected = false; msg.push("净化"); }
          msg.push("增益 " + (st.durationSec || 10) + " 秒");
          gained = true;
        }
        // 旧版 d.heal 百分比格式兼容
        if (!gained && d.heal && typeof d.heal === "object") {
          if (d.heal.hp) {
            const before = p.hp, after = Math.min(p.maxHp, before + p.maxHp * d.heal.hp), add = after - before;
            if (add >= 0.5) { p.hp = after; msg.push("生命 +" + Math.round(add)); gained = true; }
          }
          if (d.heal.sta && p.res) {
            const before = p.res.stamina, after = Math.min(p.res.maxStamina, before + p.res.maxStamina * d.heal.sta), add = after - before;
            if (add >= 0.5) { p.res.stamina = after; msg.push("体力 +" + Math.round(add)); gained = true; }
          }
        }
        if (!gained) { WK.toast("状态已满或无法生效，先留着", "good"); return false; }
        // 次数型（魔瓶）：扣 1 次而不是整瓶，简化为仍 remove 1 件；uses 仅展示
        // 豆包v165：infinite（无限能源医疗纳米机器人等）不消耗，仍走 CD 防止连点
        if (!d.infinite) this.remove(id, 1);
        const cdMs = Math.max(3000, (st.cdSec || 12) * 1000);
        p.itemCd[group] = now + cdMs;
        WK.toast((d.name || id) + "：" + msg.join("，") + " · CD " + Math.round(cdMs / 1000) + " 秒", "gold");
        if (WK.save && WK.save.write) WK.save.write();
        if (WK.renderScene) WK.renderScene();
        if (WK.ui && WK.ui.openStatus) { /* 保持面板 */ }
        return true;
      }

      if (d && d.heal) {
        if (WK.battle && WK.battle.state && WK.battle.state.active) { WK.toast("战斗中用下方战斗道具栏", "gold"); return false; }
        let msg = [], gained = false;
        // 豆包v165：固定点数回复（大表医疗桥接出的 flatHp/flatSta）
        if (d.heal.flatHp != null) {
          const before = p.hp, after = Math.min(p.maxHp || 100, before + d.heal.flatHp), add = after - before;
          if (add >= 0.5) { p.hp = after; msg.push("生命 +" + Math.round(add)); gained = true; }
        }
        if (d.heal.flatSta != null && p.res) {
          const before = p.res.stamina, after = Math.min(p.res.maxStamina || 60, before + d.heal.flatSta), add = after - before;
          if (add >= 0.5) { p.res.stamina = after; msg.push("体力 +" + Math.round(add)); gained = true; }
        }
        if (d.heal.hp) {
          const before = p.hp, after = Math.min(p.maxHp, before + p.maxHp * d.heal.hp), add = after - before;
          if (add >= 0.5) { p.hp = after; msg.push("生命 +" + Math.round(add)); gained = true; }
        }
        if (d.heal.sta && p.res) {
          const before = p.res.stamina, after = Math.min(p.res.maxStamina, before + p.res.maxStamina * d.heal.sta), add = after - before;
          if (add >= 0.5) { p.res.stamina = after; msg.push("体力 +" + Math.round(add)); gained = true; }
        }
        if (!gained) { WK.toast("生命和体力都是满的，先留着", "good"); return false; }
        if (!d.infinite) this.remove(id, 1);
        p.itemCd = p.itemCd || {};
        p.itemCd.heal = Date.now() + 12000;
        WK.toast(msg.join("，") + " · CD 12 秒", "gold");
        if (WK.save && WK.save.write) WK.save.write();
        return true;
      }
      // 豆包v165：其余道具交给功能道具框架（开锁/照明/防化/扫描/载具/电池…），保证点「使用」必有响应
      if (WK.Items && WK.Items.useGadget && WK.Items.useGadget(id)) return true;
      WK.toast("这个道具暂时无法这样使用", "bad");
      return false;
    },

    /* 豆包v131：关键物品（剧情药剂/纳戒）不允许丢弃，避免把自己卡死；其余消耗品可逐个丢弃 */
    NO_DROP: { tvirus:1, antiviral:1, ring_naring:1 },
    toggleBattleUse(id){
      const p = WK.P;
      p.itemBattle = p.itemBattle || {};
      const d = this.def(id);
      if (!d) { WK.toast("没有这个道具", "bad"); return; }
      const can = d.battleUse || d.buffKind || d.kind === "heal" || d.kind === "food" || d.kind === "throw" || d.kind === "battle" || d.kind === "charm" || d.kind === "scroll" || d.heal || (d.stats && d.stats.heal);
      if (!can && !p.itemBattle[id]) {
        WK.toast("这类道具不能设为战斗使用", "bad");
        return;
      }
      if (p.itemBattle[id]) {
        delete p.itemBattle[id];
        WK.toast((d.name || id) + "：已取消战斗使用", "good");
      } else {
        p.itemBattle[id] = true;
        WK.toast((d.name || id) + "：战斗中可使用", "gold");
      }
      if (WK.save && WK.save.write) WK.save.write();
      if (document.getElementById("ov-status") && document.getElementById("ov-status").classList.contains("active"))
        WK.ui.switchStatusTab("bag");
    },
    canDrop(id){ const d = this.def(id); return !!(d && d.bulk > 0) && !this.NO_DROP[id]; },
    drop(id, n){
      n = n || 1;
      if (!this.count(id)) { WK.toast("没有这个道具", "bad"); return; }
      if (!this.canDrop(id)) { WK.toast("这是关键物品，不能丢", "bad"); return; }
      const d = this.def(id);
      this.remove(id, n);
      WK.save.write();
      WK.renderScene && WK.renderScene();
      if (document.getElementById("ov-status").classList.contains("active")) WK.ui.openStatus("bag");
      WK.toast("丢弃了 " + d.name + " ×" + n, "good");
    },

    /* 豆包v142：回归主神空间时收缴「剧情道具」（bind:"world"）——本世界的门禁卡/情报/武器/医疗品带不走。
       T病毒原液/抗病毒血清/贵重品/红后核心（bind:"item"）与纳戒等装备（bind:"equip"）保留。
       返回被收缴的 [{id,n}]，供回归剧情弹一句提示。 */
    stripWorldBound(){
      const p = WK.P; p.items = p.items || {};
      const taken = [];
      Object.keys(p.items).forEach(id => {
        const n = p.items[id] || 0;
        if (n > 0 && WK.invBindOf(id) === "world") { taken.push({ id:id, n:n }); p.items[id] = 0; }
      });
      return taken;
    },

    /* 三分类筛选：tab = world(剧情道具) / equip(装备) / item(道具)，返回当前持有的物品 id 列表 */
    idsByBind(bind){
      const it = WK.P.items || {};
      return Object.keys(WK.ITEM_DEF).filter(id => (it[id] || 0) > 0 && WK.invBindOf(id) === bind);
    }
  };

  /* ============================================================
   * 豆包v128：关键剧情道具 WK.Items（T 病毒原液 / 抗病毒血清 / 弱化一阶基因锁）
   * 数据：P.items.tvirus、P.items.antiviral；状态：P.flags.infected / tVirusPrimed / geneLockWeak。
   * 背包与主神光球两处都能调用，逻辑统一收口在这里。
   * ============================================================ */
  WK.Items = {
    count(id){ return WK.inv.count(id); },
    _add(id, n){ WK.inv.add(id, n); },

    /* 注射 T 病毒原液：主动跳进感染状态，必须紧接一支血清收束，纯赌命 */
    useTvirus(){
      const p = WK.P;
      if (!this.count("tvirus")) { WK.toast("没有 T 病毒原液", "bad"); return; }
      if (p.flags.geneLockWeak) { WK.toast("基因锁已开，再注射原液是自杀", "bad"); return; }
      if (p.flags.tVirusPrimed) { WK.toast("病毒正在体内奔窜——快用抗病毒血清！", "bad"); return; }
      WK.ui.dialog("注射 T 病毒原液？",
        '<span class="sys">原液入体＝主动让 T 病毒在极限时间内冲击你的基因。<br>' +
        '注射后你会立刻进入<span style="color:#e0a0a0;">高危感染</span>状态，<b>必须马上再用一支抗病毒血清收束</b>：<br>' +
        '· 成功（约 ' + Math.round(WK.RULES.geneLockChance*100) + '%）：撞开「一阶基因锁·弱化」，永久小幅度变强；<br>' +
        '· 失败：血清勉强压下病毒，你捡回半条命、重伤，原液与血清都白费。<br>' +
        '不带血清就注射，等于自己把自己变成丧尸。确定？</span>',
        [
          { text:"注射原液", primary:true, act:()=>{
              WK.ui.closeOverlay("ov-dialog");
              p.items.tvirus -= 1;
              p.flags.tVirusPrimed = true;
              p.flags.infected = true;
              WK.save.write(); WK.renderScene && WK.renderScene();
              WK.log("danger", "你将幽蓝的原液推入静脉——灼烧感顺着血管炸开，肌肉不受控地痉挛。快！立刻用抗病毒血清收束！");
              WK.toast("T 病毒已注入，马上用血清！", "bad");
              WK.ui.openStatus("bag");   // 直接打开背包，引导玩家立刻点血清
            } },
          { text:"再想想", act:()=>WK.ui.closeOverlay("ov-dialog") }
        ]);
    },

    /* 抗病毒血清：普通感染→救命清除；处于原液试炼中→用来收束、判定基因锁 */
    useAntiviral(){
      const p = WK.P;
      if (!this.count("antiviral")) { WK.toast("没有抗病毒血清", "bad"); return; }
      if (p.flags.tVirusPrimed) { this._resolveTrial(); return; }
      if (!p.flags.infected) { WK.toast("你当前没有感染，血清留着救命", "good"); return; }
      p.items.antiviral -= 1;
      p.flags.infected = false;
      WK.save.write(); WK.renderScene && WK.renderScene();
      WK.log("reward", "你将翠绿的抗病毒血清注入体内，T 病毒感染被清除，灼烧感缓缓退去。");
      WK.toast("感染已清除", "gold");
    },

    /* 原液＋血清收束：掷基因锁判定（一次性，成功后不再走此路）*/
    _resolveTrial(){
      const p = WK.P;
      p.items.antiviral -= 1;
      p.flags.tVirusPrimed = false;
      p.flags.infected = false;
      const ok = !p.flags.geneLockWeak && Math.random() < WK.RULES.geneLockChance;
      if (ok) {
        p.flags.geneLockWeak = true;
        const A = WK.RULES.geneLockAttrs;
        Object.keys(A).forEach(k => { p.attrs[k] = (p.attrs[k] || 100) + A[k]; });
        p.maxHp = (p.maxHp || 100) + WK.RULES.geneLockMaxHp;
        p.hp = p.maxHp;
        WK.save.write(); WK.renderScene && WK.renderScene();
        WK.log("reward", "剧痛在某一瞬轰然炸成清明——你在病毒被血清压灭的刹那，撞开了那一扇门。一阶基因锁（弱化）已开启。");
        WK.ui.generic("基因锁 · 开启（弱化）",
          '<div style="line-height:1.9;color:#c8d6c8;">血清与原液在体内最后一次冲撞，你的视野骤然拉成一线，又猛地铺开——<br>' +
          '世界慢了下来，血液轰鸣如鼓。等到一切平息，你知道自己<span style="color:var(--gold);">跨过了某道门槛</span>。<br><br>' +
          '<span style="color:var(--gold);">神经反应 / 肌肉 / 细胞活力 / 免疫力永久提升，生命上限 +' + WK.RULES.geneLockMaxHp + '</span>。<br>' +
          '<span style="color:var(--dim);font-size:12.5px;">这是靠药物撞开的「弱化一阶」：比普通人强得多，却逊于在真正生死间顿悟的一阶，也暂时没有解锁战斗爆发——那道门，还在更前面。</span></div>' +
          '<button class="here-btn primary" style="width:100%;margin-top:14px;padding:11px;" onclick="WK.ui.closeOverlay(\'ov-generic\')">继续</button>');
      } else {
        p.hp = Math.max(1, Math.floor((p.maxHp || 100) * 0.15));
        WK.save.write(); WK.renderScene && WK.renderScene();
        WK.log("danger", "你在最后一瞬被血清拽了回来——基因锁没能撞开，只捡回半条命。");
        WK.ui.generic("差了一步",
          '<div style="line-height:1.9;color:#c8d6c8;">翠绿的血清堪堪压下暴走的病毒，你瘫倒在地、浑身脱力，大口呕着寒气。<br>' +
          '那扇门就在眼前，却没能推开。命保住了，<span style="color:#e0a0a0;">原液与一支血清都已耗尽</span>，生命跌至残血。<br><span style="color:var(--dim);font-size:12.5px;">（脱离战斗后会缓慢回血；也可去主神光球做全身修复。）</span></div>' +
          '<button class="here-btn primary" style="width:100%;margin-top:14px;padding:11px;" onclick="WK.ui.closeOverlay(\'ov-generic\')">继续</button>');
      }
    },

    /* ============================================================
     * 豆包v165：科技类功能道具通用「使用」入口（可扩展框架）
     * 装备槽 / 投掷物 / 药剂 / 文件各有专门通路，不会进到这里；这里处理 tool、功能性 misc、vehicle、battery。
     * 原则：兑换到的道具点「使用」都要有响应——
     *   蜂房用得上的给真实效果（开锁 / 照明夜视 / 防化氧气 / 扫描增益）；
     *   需要开阔空间、专门设施或后期系统的，给明确场景说明，绝不做死按钮。
     * 新道具优先在下面按名称关键词登记；拿不准的统一走末尾兜底说明。返回 true=已处理。
     * ============================================================ */
    useGadget(id){
      const p = WK.P, d = WK.inv.def(id) || {}, n = d.name || id;
      const now = Date.now();
      const okBtn = '<button class="here-btn primary" style="width:100%;margin-top:13px;padding:11px;" onclick="WK.ui.closeOverlay(\'ov-generic\')">知道了</button>';
      const persist = () => { if (WK.save && WK.save.write) WK.save.write(); WK.renderScene && WK.renderScene(); };
      const say = (html) => WK.ui.generic(n, html);
      const head = (d.desc ? d.desc + '<br><br>' : '');

      // ⓿❶ 豆包v170：娱乐类道具（整容药水/整蛊/吃喝/一立方米整人货…）的非战使用，先走娱乐反馈
      if (d.fun && WK.Fun && WK.Fun.use(id)) return true;

      // ⓪ 豆包v169：传说魔法类道具的非战使用 —— 卷轴/丹药/魔法书/胶卷，点了必有响应
      if (d.kind === "scroll" || (d.magicScroll && !d.heal)) {
        WK.toast("法术卷轴要在战斗中选定目标施放", "gold");
        return true;   // 攻击卷轴非战不放，也不消耗；治疗卷轴已在医疗链路处理（kind=heal）
      }
      if (d.buffKind) {
        p.buffs = p.buffs || {};
        if (d.buffKind === "sight") { p.buffs.gadgetSight = now + 600 * 1000; WK.toast(n + "：洞悉隐匿，接下来 10 分钟命中/暴击提升", "gold"); }
        else if (d.buffKind === "enchant") { p.buffs.enchantUntil = Math.max(p.buffs.enchantUntil || 0, now) + 300 * 1000; WK.toast(n + "：武器附上魔力，接下来 5 分钟普攻可伤灵体", "gold"); }
        if (!d.infinite) WK.inv.remove(id, 1);
        persist(); return true;
      }
      if (d.cultivate) {
        say('<div style="line-height:1.95;color:#c8d6c8;">' + head +
          '这是<b>修行体系</b>的丹药，需配合相应法门与灵脉运化。本部「名为生化」的世界没有修行环境，强行服下只会积下毒副作用、得不偿失。<br>' +
          '<span style="color:var(--gold);font-size:12.5px;">已妥善封存；进入修真 / 道术类恐怖片、习得对应功法后再使用。</span></div>' + okBtn);
        return true;
      }
      if (d.study) {
        say('<div style="line-height:1.95;color:#c8d6c8;">' + head +
          '魔法书用来<b>抄录并重现法术</b>：需先在五十米内目击目标魔法、事先准备，之后才能以同属性能量再次施放。抄录与法术技能体系将在后续恐怖片开放。<br>' +
          '<span style="color:var(--gold);font-size:12.5px;">已持有；不同材质的书能储存的法术强度不同。</span></div>' + okBtn);
        return true;
      }
      if (d.filmRoll) {
        say('<div style="line-height:1.95;color:#c8d6c8;">' + head +
          '这是装入<b>射影机</b>的特制胶卷，专门用来拍摄、镇压鬼怪。请先装备射影机。<br>' +
          '<span style="color:var(--gold);font-size:12.5px;">已持有；不同制式胶卷对灵体的克制与威力将在咒怨类恐怖片实装。</span></div>' + okBtn);
        return true;
      }

      // ① 载具 / 机甲 / 飞船 / 重型设施：蜂房是封闭地下空间，无法展开
      if (d.kind === "vehicle" || (WK.TECH_LARGE_RE && WK.TECH_LARGE_RE.test(n))) {
        say('<div style="line-height:1.95;color:#c8d6c8;">' + head +
          '这是一件需要<b>开阔空间 / 专门设施</b>才能展开的重型装备。你此刻身处深埋地下的「蜂房」，狭窄通道与气密门容纳不下它。<br>' +
          '<span style="color:var(--gold);font-size:12.5px;">已登记为持有物；将在对应的载具战 / 未来 / 开阔场景开放调用。</span></div>' + okBtn);
        return true;
      }

      // ② 开锁 / 破解类：激活万能通行（仅对刷卡电子锁；redqueen/路线/传送等主线锁不绕过）
      if (/万能钥匙|拟态钥匙|密码黑客|黑客模块|解锁|破解/.test(n)) {
        if (p.flags.masterKey) { WK.toast("万能通行已处于激活状态", "good"); return true; }
        p.flags.masterKey = true; persist();
        say('<div style="line-height:1.95;color:#c8d6c8;">' + head +
          '你激活了它，一层几不可察的电子「权限」附着到主神手表上。<br>' +
          '<span style="color:var(--gold);">本部恐怖片内，所有刷卡 / 权限类电子门都会自动放行。</span><br>' +
          '<span style="color:var(--dim);font-size:12.5px;">注意：火焰女皇主控的核心封锁与主线剧情锁无法以此绕过。</span></div>' + okBtn);
        return true;
      }

      // ③ 照明 / 夜视 / 望远：短时命中·暴击增益（进战斗真实生效，见 combat.profile）
      if (/夜视|望远|照明|荧光|打火机/.test(n)) {
        const strong = /夜视|望远/.test(n), sec = strong ? 180 : 60;
        p.buffs = p.buffs || {}; p.buffs.gadgetSight = now + sec * 1000;
        if (/照明棒/.test(n) && !d.infinite) WK.inv.remove(id, 1);
        persist();
        WK.toast(n + "：穿透黑暗，接下来 " + sec + " 秒命中/暴击提升", "gold");
        return true;
      }

      // ④ 氧气 / 防化 / 防毒：当场清除感染，并获得一段时间的毒气·空气感染免疫
      if (/氧气|面罩|防化|防毒/.test(n)) {
        p.flags.gasImmuneUntil = now + 30 * 60 * 1000; p.flags.gasImmune = true;
        let extra = "";
        if (p.flags.infected) { p.flags.infected = false; extra = "，并清除了已侵入的 T 病毒感染"; }
        persist();
        WK.toast(n + "：30 分钟内免疫毒气与空气感染" + extra, "gold");
        return true;
      }

      // ⑤ 侦察 / 扫描 / 战斗分析：战术增益（命中·暴击，真实生效）
      if (/扫描|雷达|分析|辅助系统|探测/.test(n)) {
        p.buffs = p.buffs || {}; p.buffs.gadgetScan = now + 180 * 1000;
        persist();
        WK.toast(n + "：战术分析上线，接下来 3 分钟命中/暴击提升", "gold");
        return true;
      }

      // ⑥ 能源 / 电池：为能量武器 / 动力装甲供能——本集以枪械冷兵器为主，暂无耗能装备
      if (d.kind === "battery" || /电池|发电机|能量核心|充能/.test(n)) {
        say('<div style="line-height:1.95;color:#c8d6c8;">' + head +
          '高能能源单元已妥善收纳，用于为<b>能量武器 / 动力装甲 / 大型设备</b>供能。' +
          '本部「名为生化」以枪械与冷兵器为主，暂无需要它驱动的装备。<br>' +
          '<span style="color:var(--gold);font-size:12.5px;">已持有；兑换相应能量装备后，自动作为供弹 / 能源计入。</span></div>' + okBtn);
        return true;
      }

      // ⑦ 强化芯片：植入型，属后期「身体改造」体系（需神经植入槽）
      if (/强化芯片|芯片/.test(n)) {
        say('<div style="line-height:1.95;color:#c8d6c8;">' + head +
          '这是需要植入神经槽位的<b>强化芯片</b>。植入与多芯片协同属于后期「身体改造」体系，你目前还没有可用的植入槽。<br>' +
          '<span style="color:var(--gold);font-size:12.5px;">已安全封存；植入槽开放后即可装载（感官 / 意志 / 心灵 / 黑客 / 自爆等模块）。</span></div>' + okBtn);
        return true;
      }

      // ⑦b 控制型战术弹（闪光/烟雾/催泪）：不造直接伤害，需战斗「致盲 / 掩护 / 压制」状态系统——
      //     该系统紧随其后开放；此处如实告知，不做虚假伤害。
      if (/闪光弹|震撼弹|烟雾弹|催泪|瓦斯|毒气弹/.test(n)) {
        const eff = /闪光|震撼/.test(n) ? "致盲（敌人下一轮攻击落空）"
          : /烟雾/.test(n) ? "烟雾掩护（短时大幅提升闪避）" : "催泪压制（敌人攻击间隔变长、命中下降）";
        say('<div style="line-height:1.95;color:#c8d6c8;">' + head +
          '这是<b>控制型战术投掷物</b>，效果是' + eff + '，而非直接造成伤害。<br>' +
          '战斗引擎的「敌人状态（致盲 / 减速 / 压制）」模块正在接入，到位后即可在战斗道具栏投掷生效。<br>' +
          '<span style="color:var(--gold);font-size:12.5px;">当前版本先收存；直接伤害类的破片 / 高爆 / 神圣手雷已可在战斗中使用。</span></div>' + okBtn);
        return true;
      }

      // ⑧ 兜底：其余功能道具展示用途，明确本集触发场景——保证任何道具都不是死按钮
      say('<div style="line-height:1.95;color:#c8d6c8;">' + (d.desc || "一件特殊道具。") +
        '<br><br><span style="color:var(--dim);font-size:12.5px;">本部恐怖片（蜂房）暂无该道具的触发场景，已收入背包；' +
        '在对应的恐怖片 / 场景条件满足时会自动生效。</span></div>' + okBtn);
      return true;
    }
  };

  // 豆包N2：毫秒 → h:mm:ss / m:ss
  function fmtMS(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60;
    const pad = x => String(x).padStart(2, "0");
    return (h > 0 ? pad(h) + ":" : "") + pad(m) + ":" + pad(ss);
  }
  WK.fmtMS = fmtMS;

  /* —— 任务表 —— */
  WK.quest = {
    add(q) {
      const p = WK.P;
      if (!p.quests.some(x => x.id === q.id)) { p.quests.push(q); WK.save.write(); }
    },
    get(id) { return WK.P.quests.find(x => x.id === id); },
    setState(id, state, silent) {
      const q = this.get(id);
      if (!q || q.state === state) return;
      q.state = state;
      if (!silent) WK.log("quest", "任务「" + q.title + "」" + ({ done: "完成", failed: "失败" }[state] || state));
      WK.save.write();
    }
  };

  WK.rules = {
    /* —— 点数唯一出入口：加扣点都走这里，自动流水/日志/飘字/存档 —— */
    addPoints(n, reason) {
      const p = WK.P;
      if (!p) return;
      p.points += n;
      p.ledger.push({ n, reason: reason || "", t: Date.now() });
      WK.log(n >= 0 ? "reward" : "danger",
        (n >= 0 ? "奖励点数 +" : "奖励点数 ") + n + (reason ? "：" + reason : ""));
      WK.toast((n >= 0 ? "+" : "") + n + " 点", n >= 0 ? "good" : "bad");
      WK.save.write();
      WK.renderWatchHUD();
    },

    /* —— 击杀计分，kind: crawler / rookie；丧尸走 killZombies 群结算 —— */
    kill(kind) {
      const p = WK.P;
      if (kind === "zombie") {
        // 单只接口保留给 N6 战斗内部逐只统计；不即时发点、不刷飘字，
        // 战斗清场统一由 killZombies / settleZombies 折算。
        p.kills.zombie++;
        return;
      } else if (kind === "crawler") {
        p.kills.crawler++;
        this.addPoints(WK.RULES.crawlerPoint, "击杀爬行者");
      } else if (kind === "rookie") {
        p.kills.rookie++;
        this.addPoints(WK.RULES.rookiePoint, "杀害新人");
      }
      WK.save.write();
      WK.renderWatchHUD();
    },

    /* —— 豆包N2：丧尸「群战」结算（N6 一场战斗遭遇一群，清场调一次）——
     * 底层仍是原著口径：累计每 10 只折 1 点；用 zombiePaid 记已发点数，
     * 不足 10 只的零头累计到下一场。玩家体感＝打一场群战 +1 点。 */
    killZombies(n, label) {
      const p = WK.P;
      n = Math.max(0, Math.floor(n || 0));
      if (n <= 0) return;
      p.kills.zombie += n;
      WK.log("dmg", "歼灭丧尸群 " + n + " 只（累计 " + p.kills.zombie + " 只）");
      this.settleZombies(label);
    },

    /* 豆包N6：一场群战清场结算 —— 玩家口径「打一场 +1 点」。
       先走原著 10 只=1 点折算；若这一场没折出点（不足 10 只的小群），保底补 1 点；
       若已靠累计凑够 10 只发出了点，则不重复补发。大群/连场都保证每场至少 1 点。 */
    settleZombieBattle(n, label) {
      const p = WK.P, before = p.points;
      this.killZombies(n, label);
      if (p.points === before) this.addPoints(1, label || "歼灭丧尸群 · 清场奖励");
    },

    /* 豆包v138 N19：丧尸犬群清场结算。口径与丧尸群一致——每 10 只折 1 点、不足保底每场 1 点，
       但独立累计（kills.dog / dogPaid），不与丧尸池混算。*/
    settleDogBattle(n, label) {
      const p = WK.P, before = p.points;
      n = Math.max(0, Math.floor(n || 0));
      if (n <= 0) return;
      p.kills.dog += n;
      WK.log("dmg", "歼灭丧尸犬群 " + n + " 只（累计 " + p.kills.dog + " 只）");
      const due = Math.floor(p.kills.dog / WK.RULES.zombiePerPoint);
      const add = due - (p.kills.dogPaid || 0);
      if (add > 0) { p.kills.dogPaid = due; this.addPoints(add, label || ("歼灭丧尸犬群（每 " + WK.RULES.zombiePerPoint + " 只折 1 点）")); }
      if (p.points === before) this.addPoints(1, label || "歼灭丧尸犬群 · 清场奖励");
      else WK.save.write();
      WK.renderWatchHUD && WK.renderWatchHUD();
    },

    /* 按累计只数补发差额点数（战斗中途也可调，保证不重不漏） */
    settleZombies(label) {
      const p = WK.P;
      const due = Math.floor(p.kills.zombie / WK.RULES.zombiePerPoint);
      const add = due - p.kills.zombiePaid;
      if (add > 0) {
        p.kills.zombiePaid = due;
        this.addPoints(add, label || ("歼灭丧尸群（每 " + WK.RULES.zombiePerPoint + " 只折 1 点）"));
      } else {
        WK.toast("丧尸群清空，零头 " + (p.kills.zombie % WK.RULES.zombiePerPoint) + " 只计入下场", "");
      }
      WK.save.write();
      WK.renderWatchHUD();
    },

    /* —— 禁忌话题：在剧情人物听得到的地方说漏嘴，每句 -10 —— */
    swear(reason) {
      WK.log("god", "【主神】警告：禁止在剧情人物面前讨论禁忌话题。");
      this.addPoints(WK.RULES.swearPenalty, reason || "在剧情人物面前提及主神 / 奖励点");
    },

    /* —— 锚点人物与 100 米规则（N7 楼梯将用它驱动距离）—— */
    setAnchor(name) {
      const p = WK.P;
      p.anchor = { active: true, name, distance: 0 };
      WK.log("quest", "手表左上角浮现名字：" + name + "。离开其 " + WK.RULES.anchorLimit + " 米将被抹杀。");
      WK.save.write(); WK.renderWatchHUD();
    },
    clearAnchor() {
      const p = WK.P;
      if (p.anchor.active) WK.log("sys", "手表上的名字消失了——你可以自由行动。");
      p.anchor = { active: false, name: "", distance: 0 };
      WK.save.write(); WK.renderWatchHUD();
    },
    addAnchorDistance(d) {
      const p = WK.P;
      if (!p.anchor.active) return;
      p.anchor.distance = Math.max(0, p.anchor.distance + d);
      WK.renderWatchHUD();
      this.checkAnchor();
    },
    checkAnchor() {
      const p = WK.P;
      // 豆包v120：测试面板「锚点无敌」开启时不抹杀（仅 beta 调试救人分支用，正式版随测试面板一并删除）
      if (p.flags && p.flags._godTest) return;
      if (p.anchor.active && p.anchor.distance > WK.RULES.anchorLimit)
        this.erase("离开剧情人物「" + p.anchor.name + "」超过 " + WK.RULES.anchorLimit + " 米");
    },

    /* —— 手表倒计时（真实墙钟，刷新页面也继续走）—— */
    startWatch(ms) {
      const w = WK.P.watch;
      w.running = true; w.ended = false; w.rewarded = false;
      w.startAt = Date.now();
      w.durationMs = ms || WK.RULES.watchMinutes * 60000;
      this.ensureMainQuest();
      WK.log("god", "【主神】手表倒计时开始——存活到时间结束。");
      WK.save.write();
      WK.renderWatchHUD();
      this.tick();
    },
    /* 豆包N12：剧情强制时间到（A/B 终局战结束），立即走正常结算→回归 */
    forceTimeUp() {
      const w = WK.P.watch;
      if (w.ended) { if (WK.STORY12 && WK.STORY12.onTimeUp) WK.STORY12.onTimeUp("force"); return; }
      w.startAt = Date.now() - w.durationMs;
      this.finishWatch();
    },
    stopWatch() { // 仅供 N2 测试面板使用
      WK.P.watch.running = false;
      if (watchTimer) { clearInterval(watchTimer); watchTimer = null; }
      WK.renderWatchHUD();
    },
    remainMs() {
      const w = WK.P.watch;
      if (!w.running) return w.ended ? 0 : w.durationMs;
      return Math.max(0, w.startAt + w.durationMs - Date.now());
    },
    tick() {
      if (watchTimer) clearInterval(watchTimer);
      watchTimer = setInterval(() => {
        const p = WK.P;
        if (!p) return;
        WK.renderWatchHUD();
        WK.ui.refreshWatchLive && WK.ui.refreshWatchLive();
        if (p.watch.running && this.remainMs() <= 0) this.finishWatch();
      }, 250);
    },
    resumeTick() { // 读档后恢复；若现实时间已过终点，立即结算
      const p = WK.P;
      if (!p || !p.watch.running) return;
      if (this.remainMs() <= 0) { this.finishWatch(); return; }
      this.tick();
    },

    finishWatch() {
      const p = WK.P, w = p.watch;
      if (w.ended) return;
      w.running = false; w.ended = true;
      if (watchTimer) { clearInterval(watchTimer); watchTimer = null; }
      WK.renderWatchHUD(); WK.save.write();
      // 原著规则：结束时仍为负分 → 抹杀（李萧毅 -10 由基础 1000 覆盖，不抹杀）
      if (p.points < 0) { this.erase("恐怖片结束时奖励点数为负（" + p.points + "）"); return; }
      if (!w.rewarded) {
        w.rewarded = true;
        WK.quest.setState("q_survive", "done");
        this.addPoints(WK.RULES.baseReward, "活过恐怖片《生化危机一》基础奖励");
      }
      // 豆包N12：时间到＝存活即可回归（原著：身处任何地方都会被主神直接送走）
      if (WK.STORY12 && WK.STORY12.onTimeUp) WK.STORY12.onTimeUp("watch");
      else WK.ui.showSettle(); // N13 之前的占位结算
    },

    /* —— 抹杀 = 真死：弹主神宣告，确认后清档回标题 —— */
    erase(reason) {
      const p = WK.P;
      if (!p || p.dead) return;
      p.dead = true;
      p.watch.running = false;
      if (watchTimer) { clearInterval(watchTimer); watchTimer = null; }
      // 豆包v166：死亡/负分抹杀不再清空存档，也不把 dead=true 落盘（故此处刻意不调
      // quest.setState（它会 save.write）与 save.clear）。三个槽里保留死亡前最近一次进度，
      // 玩家回标题即可读取重来；p.dead 仅存在于内存，用于本局防重入。
      document.getElementById("float-layer").innerHTML = ""; // 清掉残留飘字，不挡主神宣告
      WK.ui.closeAll();
      WK.ui.dialog("主神",
        '<span class="godline">【主神】</span>\n<span class="danger">' + reason + "。</span>\n\n" +
        '<span style="color:var(--dim);font-size:12.5px;line-height:1.9;">意识沉入黑暗的前一刻，' +
        "你想起出发前在手表里留下的存档……</span>",
        [{ text: "回到标题 · 读取存档", danger: true, act: () => {
            WK.P = null;
            WK.ui.closeOverlay("ov-dialog");
            WK.ui.backToTitle();
        } }]);
    },

    ensureMainQuest() {
      if (!WK.quest.get("q_survive"))
        WK.quest.add({ id: "q_survive", type: "main", title: "在蜂房存活到手表倒计时结束", state: "active" });
      else
        WK.quest.setState("q_survive", "active", true);
    }
  };

  /* ============================================================
   * 豆包N2：记忆闪回（foresight）
   * 玩家「看过这部电影」，关键节点手表震动、脑内预知，可据此接先知支线。
   * N9 事件管道会自动调用；N2 先提供 UI 与数据入口。
   * ============================================================ */
  WK.foreshow = function (title, html, actions) {
    document.getElementById("fs-title").textContent = title;
    document.getElementById("fs-body").innerHTML = html;
    const box = document.getElementById("fs-actions");
    box.innerHTML = "";
    (actions || [{ text: "知道了" }]).forEach(o => {
      const b = document.createElement("button");
      b.className = "here-btn" + (o.primary ? " primary" : o.danger ? " danger" : "");
      b.textContent = o.text;
      b.onclick = () => { WK.ui.closeOverlay("ov-foreshow"); if (o.act) o.act(); };
      box.appendChild(b);
    });
    document.getElementById("ov-foreshow").classList.add("active");
  };


/* ===== 技能框架 + 战斗模型 + 基因锁 + 队友系统 + 苦战营救 ===== */
  /* ============================================================
   * 豆包N6：五类型技能框架 + ATB 实时战斗引擎
   * ------------------------------------------------------------
   * 【技能五类型】对应整本《无限恐怖》的兑换大杂烩，统一一套接口：
   *   firearm 枪械（科技·热兵器，本集实装，耗 stamina 体力）
   *   magic   魔法传说（道符/卷轴/血族法术，耗 mana 法力，本集仅骨架）
   *   martial 武功（中国气功/内力武学，耗 neili 内力，本集仅骨架）
   *   aux     辅助（包扎/闪避/观察等通用技，耗 stamina）
   *   mecha   机甲（重装机甲/载具火力，耗 energy 能量，本集仅骨架）
   * 资源槽 res{stamina,mana,neili,energy} 已在 newPlayer 一次性预留；
   * 高级技能用 locked:true 灰显，等 N13 主神空间兑换点亮。魔法/武功/机甲的
   * 复杂结算建议后续单独扩写（可交 GPT）：在 def 上挂 calc/onUse(ctx) 钩子即可，
   * 引擎已预留调用位，无需改战斗主循环。
   *
   * 【战斗形态】ATB 集气条实时制（移植江湖版手感）：普攻出手快、重技需集气；
   * 技能 CD 遮罩；敌人按速度定时进攻；右上 1×/2× 倍速。
   * 【预留·N7 队友】opts.allies 传入队友后自动协助攻击/显示姓名。
   * 【预留·N12 主动索敌】剧情可直接 Battle.start(room,{wave,aggro:true})，
   *   让爬行者进入玩家所在地图块强制开战。
   * 【预留·N12 特殊战斗】opts.defeatMode='return'：团灭不抹杀，改调 onDefeat
   *   （A 线最终战——被爬行者全灭，或战胜并熬到手表归零，都回归主神空间）；
   *   'erase'=正式死亡走抹杀；'test'=漫游测试，倒地回 1 血。
   * ============================================================ */

  WK.SKILL_META = {
    firearm:{ label:"枪械", res:"stamina" },
    magic:  { label:"魔法", res:"mana" },
    martial:{ label:"武功", res:"neili" },
    aux:    { label:"辅助", res:"stamina" },
    mecha:  { label:"机甲", res:"energy" },
    blood:  { label:"血族", res:"blood" },
    rage:   { label:"狼人", res:"rage" },
    virus:  { label:"病毒", res:"virus" },
    spirit: { label:"精神", res:"spirit" },
    nature: { label:"自然", res:"nature" },
    erosion:{ label:"蚀力", res:"erosion" },
    ling:   { label:"灵力", res:"ling" }
  };

  /* def 字段：name/type/kind(attack|heal|dodge|buff|ultimate)
   * res 资源键,cost 消耗,cd 毫秒,charge 所需集气(0~100),base 基准伤害,heal 回血比例,
   * hit 命中加成,crit 爆头率加成,critMult 爆头倍率(对无法即杀的强怪),
   * tgt single 单体 | group 整组,locked 本集未解锁,desc 说明。
   * 扩展钩子（高级技能用，本集引擎已留调用位）：
   *   calc(ctx)->{hit,crit,dmg} 自定义命中/伤害；onUse(ctx) 自定义副作用。 */
  WK.SKILL_DEF = {

    /* —— v160 血统第2期：血族法术（消耗血族能量 blood）—— */
    blood_sight: { name:"鲜血视觉", type:"blood", kind:"buff", res:"blood", cost:12, cd:8000, charge:25,
      buffMs:12000, hit:0.12,
      desc:"【血族】进入鲜血视觉：只能感知血液与有血生物，可窥见隐身单位；期间命中提升。" },
    blood_flame: { name:"红炎", type:"blood", kind:"attack", res:"blood", cost:22, cd:5000, charge:40,
      
      base:10, mult:0.12, powerStat:"mind", lineScaleFromBlood:true, hit:0.08, crit:0.12, critMult:1.5, tgt:"single", spiritBonus:1.35,
      desc:"【血族】血色火焰附着燃烧，对灵类生物特别有效。" },
    blood_darkhunt: { name:"黑暗狩猎", type:"blood", kind:"buff", res:"blood", cost:28, cd:14000, charge:35,
      buffMs:10000, hit:0.08, crit:0.06, chargeSpd:0.15,
      desc:"【血族】展开黑暗域：你不受影响，域内集气与命中得到强化。" },
    blood_spear: { name:"鲜血之矛", type:"blood", kind:"attack", res:"blood", cost:32, cd:6000, charge:45,
      
      base:12, mult:0.14, powerStat:"mind", lineScaleFromBlood:true, hit:0.10, crit:0.15, critMult:1.7, tgt:"single", armorPen:0.35,
      desc:"【血族】高穿透鲜血之矛，穿刺非不死生物。" },
    blood_rain: { name:"血色暴雨", type:"blood", kind:"attack", res:"blood", cost:45, cd:16000, charge:55,
      
      base:8, mult:0.10, powerStat:"mind", lineScaleFromBlood:true, hit:0.05, crit:0.08, critMult:1.3, tgt:"group",
      desc:"【血族】降下血色暴雨，对全场非不死敌人造成腐蚀伤害。" },
    blood_bat: { name:"化身蝙蝠", type:"blood", kind:"dodge", res:"blood", cost:30, cd:18000, charge:30,
      dodgeMs:4000,
      desc:"【血族】化身蝙蝠群，短时间内大幅规避物理打击。" },
    /* —— v161 其他血统签名技能 —— */
    wolf_claw: { name:"狼爪撕裂", type:"rage", kind:"attack", res:"rage", cost:18, cd:4000, charge:35,
      
      base:10, mult:0.13, powerStat:"phys", lineScaleFromBlood:true, hit:0.10, crit:0.18, critMult:1.6, tgt:"single",
      desc:"【狼人】以兽化力量撕裂目标，暴击更高。" },
    wolf_howl: { name:"月下狼嚎", type:"rage", kind:"buff", res:"rage", cost:20, cd:12000, charge:30,
      buffMs:10000, hit:0.06, crit:0.10, chargeSpd:0.12,
      desc:"【狼人】激发野性，短时提升命中、暴击与集气。" },
    virus_burst: { name:"T病毒爆发", type:"virus", kind:"attack", res:"virus", cost:25, cd:7000, charge:40,
      
      base:12, mult:0.11, powerStat:"body", lineScaleFromBlood:true, hit:0.06, crit:0.10, critMult:1.4, tgt:"single",
      desc:"【T病毒】强制激发体内病毒活性，造成高破坏并小幅自损。" },
    spider_web: { name:"蜘蛛丝", type:"aux", kind:"buff", res:"stamina", cost:10, cd:6000, charge:20,
      buffMs:8000, hit:0.15,
      desc:"【蜘蛛侠】射出蛛丝束缚/荡移，短时大幅提升命中（任何情况下可用）。" },
    fog_london: { name:"雾都", type:"spirit", kind:"buff", res:"spirit", cost:22, cd:14000, charge:35,
      buffMs:12000, hit:0.10,
      desc:"【开膛手】浓雾弥漫，屏蔽侦测；雾中你的命中提升。" },
    clue_net: { name:"线索之网", type:"spirit", kind:"buff", res:"spirit", cost:15, cd:10000, charge:25,
      buffMs:15000, hit:0.08,
      desc:"【线索之网】整合情报，短时提升命中与洞察（叙事：可合并线索）。" },
    photo_synth: { name:"光合作用", type:"nature", kind:"heal", res:"nature", cost:10, cd:8000, charge:20,
      heal:0.12,
      desc:"【植物】沐浴光能，恢复生命与自然能量。" },
    troll_regrow: { name:"巨魔再生", type:"aux", kind:"heal", res:"stamina", cost:15, cd:10000, charge:30,
      heal:0.25,
      desc:"【巨魔】强制催动再生，一次回复大量生命（需身躯大体完整）。" },
    shine_pulse: { name:"闪灵脉冲", type:"spirit", kind:"attack", res:"spirit", cost:20, cd:5000, charge:35,
      
      base:10, mult:0.12, powerStat:"mind", lineScaleFromBlood:true, hit:0.12, crit:0.10, critMult:1.5, tgt:"single",
      desc:"【闪灵】精神冲击，优先打击神经与意志。" },
    magic_shot: { name:"魔弹齐射", type:"spirit", kind:"attack", res:"spirit", cost:24, cd:5500, charge:40,
      
      base:11, mult:0.13, powerStat:"mind", lineScaleFromBlood:true, hit:0.14, crit:0.12, critMult:1.5, tgt:"single",
      desc:"【魔弹射手】凝聚魔力弹丸高速射击。" },
    erosion_touch: { name:"蚀之力", type:"erosion", kind:"attack", res:"erosion", cost:26, cd:6000, charge:40,
      
      base:11, mult:0.12, powerStat:"mind", lineScaleFromBlood:true, hit:0.08, crit:0.10, critMult:1.4, tgt:"single",
      desc:"【罗睺】以侵蚀性负面能量撕咬目标。" },
    ling_bolt: { name:"灵力激流", type:"ling", kind:"attack", res:"ling", cost:18, cd:4500, charge:35,
      
      base:9, mult:0.11, powerStat:"mind", lineScaleFromBlood:true, hit:0.10, crit:0.08, critMult:1.4, tgt:"single",
      desc:"【神阙】轻量化灵力激射，易操作但单发威力中等。" },

    /* —— 本集实装：普通人 + 一把手枪 + 求生本能 —— */
    shoot: { name:"手枪射击", type:"firearm", kind:"attack", res:null, cost:0, cd:0, charge:0,
      base:20, hit:0.05, crit:0.05, critMult:1.8, tgt:"single", auto:true,
      desc:"【自动普攻】集气满时自动开火。出手快、不耗体力；近距离对丧尸有小概率爆头即杀。" },
    aim: { name:"精准点射", type:"firearm", kind:"attack", res:"stamina", cost:8, cd:1600, charge:55,
      base:30, hit:0.28, crit:0.40, critMult:1.6, tgt:"single",
      desc:"屏息瞄准弱点，命中与爆头率都高；对爬行者造成爆头倍伤。" },
    burst: { name:"三连射", type:"firearm", kind:"attack", res:"stamina", cost:12, cd:2400, charge:70,
      base:15, hit:0.0, crit:0, tgt:"group",
      desc:"朝整群敌人快速倾泻三发，适合清理成群丧尸。" },
    bandage: { name:"自我包扎", type:"aux", kind:"heal", res:"stamina", cost:18, cd:12000, charge:40,
      heal:0.34,
      desc:"撕开急救包紧急处理伤口，恢复约三分之一生命。" },
    dodge: { name:"紧急闪避", type:"aux", kind:"dodge", res:"stamina", cost:10, cd:5000, charge:30,
      dodgeMs:2200,
      desc:"矮身翻滚，接下来 2 秒敌人命中率大幅下降。" },

    /* —— 豆包N13：主神空间兑换技能（本集开放 科技 / 辅助；购买后写入 P.skills 即解锁）—— */
    deagle: { name:"沙漠之鹰", type:"firearm", kind:"attack", res:"stamina", cost:6, cd:2600, charge:62,
      base:55, hit:0.15, crit:0.35, critMult:2.2, tgt:"single",
      desc:"【科技】大口径手枪，单发高伤、高爆头倍率，可稳定击穿爬行者的护甲。价格 100 点。" },
    smg: { name:"冲锋枪·火力压制", type:"firearm", kind:"attack", res:"stamina", cost:14, cd:3000, charge:72,
      base:26, hit:0.10, crit:0, tgt:"group",
      desc:"【科技】冲锋枪长点射横扫整组敌人，清群丧尸效率远胜手枪。价格 150 点。" },
    shoot_mastery: { name:"高级射击精通", type:"firearm", kind:"passive", res:null, cost:0, cd:0, charge:0,
      passive:{ hit:0.08, crit:0.10 },
      desc:"【科技·被动】系统化枪械战斗训练：全体枪械技能命中 +8%、爆头率 +10%（常驻，无需施放）。价格 200 点。" },
    medspray: { name:"急救喷雾", type:"aux", kind:"heal", res:"stamina", cost:10, cd:14000, charge:45,
      heal:0.60,
      desc:"【辅助】主神出品的快速愈合喷雾，一次恢复约 60% 生命。价格 80 点。" },

    /* —— 框架示例：魔法/武功/机甲，本集锁定展示（后续恐怖片 + 支线剧情开放，复杂实现可交后续扩写）—— */
    tao_fire: { name:"烈火道符", type:"magic", kind:"attack", res:"mana", cost:20, cd:4000, charge:60,
      base:70, hit:0.2, crit:0.1, tgt:"group", locked:true,
      desc:"【魔法·框架示例】传说系兑换，掷出火焰道符焚烧整组敌人。N13 于主神空间兑换后解锁，复杂效果可挂 calc/onUse。" },
    qigong: { name:"中国气功", type:"martial", kind:"buff", res:"neili", cost:15, cd:8000, charge:50,
      locked:true,
      desc:"【武功·框架示例】原著 500 点 + D 级支线。运功强化肉身/内力，提升攻防与体力回复。N13 解锁。" },
    mecha_pile: { name:"机甲·打桩轰击", type:"mecha", kind:"ultimate", res:"energy", cost:40, cd:9000, charge:90,
      base:200, hit:0.15, tgt:"group", locked:true,
      desc:"【机甲·框架示例】重装机甲的范围火力，energy 驱动。N13/后续卷扩写。" }
  };
  /* 本集默认随身携带的可战斗技能（不需购买）；其余须 N13 兑换后写入 P.skills */
  WK.DEFAULT_SKILLS = [];


  /* ============================================================
   * 豆包v144：统一战斗模型 WK.combat
   * ------------------------------------------------------------
   * 所有出手单位（玩家 / 队友 / 未来敌对轮回者）走同一套：
   *   六维 → 基础攻防与集气 → 血统修正 → 装备（近战加值 / 远程浮动）→ 弹药/箭矢修正
   *
   * 【近战武器】dmg = 基础攻 + 武器固定加成；集气速度吃六维综合（偏 mus+ner）
   * 【远程枪械】dmg 在 [dmgMin,dmgMax] 浮动：神经反应+肌肉越高，越贴近上限（瞄准要害）
   *             集气≈换弹/举枪节奏，主要吃 ner+mus
   * 【弓】同远程逻辑；附魔箭在背包则对所有弓生效
   * 【特殊子弹】如灵类子弹：背包持有即对所有枪械普攻生效（不区分枪型）
   *
   * profile(actor) 返回只读战斗档案；rollAttack(profile, enemyDef, opts) 结算一击。
   * ============================================================ */
  WK.combat = {
    /* —— 武器分类 —— */
    wepKind(def){
      if (!def) return "unarmed";
      if (def.wepType) return def.wepType; // melee | ranged | bow
      if (def.type === "firearm" || def.kind === "weapon" && def.slot === "weapon") {
        // 默认带 type:firearm 的实体枪 = ranged
        if (def.type === "firearm") return "ranged";
      }
      if (def.kind === "weapon" && def.slot === "weapon") return def.wepType || "melee";
      return "unarmed";
    },

    slotOf(id){
      const d = WK.ITEM_DEF && WK.ITEM_DEF[id];
      if (!d) return null;
      if (d.slot) return d.slot;
      if (d.kind === "weapon" || d.type === "firearm") return "weapon";
      if (d.kind === "armor") return "armor";
      if (d.kind === "equip" && id === "ring_naring") return "ring";
      return null;
    },

    /* 从玩家 / 队友模板构造统一 actor */
    actorPlayer(){
      const p = WK.P;
      const eff = (WK.GeneLock && WK.GeneLock.effectiveAttrs) ? WK.GeneLock.effectiveAttrs(p) : ((p && p.attrs) || { int:100, spi:100, cel:100, ner:100, mus:100, imm:100 });
      return {
        id: "player", name: (p && p.name) || "我",
        attrs: eff,
        equip: (p && p.equip) || {},
        bloodline: (p && p.bloodline) || null,
        items: (p && p.items) || {},
        skills: (p && p.skills) || {},
        buffs: (p && p.buffs) || null,   // 豆包v165：科技功能道具临时增益（夜视/扫描）经此进入战斗数值
        isPlayer: true
      };
    },
    /* 队友：有六维用六维；没有则从 ally 档位反推近似六维，保证同一公式 */
    actorAlly(a){
      const attrs = a.attrs || this._attrsFromAllyTemplate(a);
      return {
        id: a.id, name: a.name,
        attrs: attrs,
        equip: a.equip || {},
        bloodline: a.bloodline || null,
        items: a.items || {},
        skills: a.skills || {},
        isPlayer: false,
        // 模板保底攻击（无装备时用）
        templateAtk: a.atk
      };
    },
    _attrsFromAllyTemplate(a){
      // 反推：atk≈14+(mus-100)*0.12 → mus≈100+(atk-14)/0.12
      const atk = a.atk || 14;
      const hit = a.hit || 0.05;
      const crit = a.crit || 0.05;
      const mus = Math.round(100 + (atk - 14) / 0.12);
      const ner = Math.round(100 + ((hit - 0.05) / 0.0015 + (crit - 0.05) / 0.001) / 2);
      return {
        int: 100, spi: 100, cel: 100,
        mus: Math.max(60, Math.min(220, mus)),
        ner: Math.max(60, Math.min(220, ner)),
        imm: 100
      };
    },

    /* 背包弹药修正：灵类子弹等对所有枪生效；附魔箭对所有弓生效 */
    ammoMods(items){
      // 豆包v165：改为遍历背包、按 ITEM_DEF.ammoTag 聚合——大表导入的特殊子弹（t_xxx）才真正生效。
      // 旧的硬编码许可弹 id（ammo_spirit 等）保留兼容；附魔类取背包中最高等级。
      const mods = { spirit:false, silver:false, fire:false, holy:false, uranium:false, uv:false, hi:false,
                     ench:0, arrowEnch:0 };
      items = items || {};
      if ((items.ammo_spirit || 0) > 0) mods.spirit = true;
      if ((items.ammo_silver || 0) > 0) mods.silver = true;
      if ((items.ammo_fire || 0) > 0) mods.fire = true;
      if ((items.ammo_holy || 0) > 0) mods.holy = true;
      [1,2,3,4,5,6].forEach(lv => { if ((items["arrow_ench_"+lv] || 0) > 0) mods.arrowEnch = Math.max(mods.arrowEnch, lv); });
      Object.keys(items).forEach(id => {
        if ((items[id] || 0) <= 0) return;
        const d = WK.ITEM_DEF && WK.ITEM_DEF[id];
        if (!d) return;
        // 附魔弹（枪械 / 箭）：id 形如 ... 名含「附魔+N」或 ammoTag==='ench'
        if (d.ammoTag === "ench" || /附魔\+?\s*([1-6])/.test(d.name || "")) {
          const lv = parseInt(RegExp.$1, 10) || 1;
          if (/箭/.test(d.name || "")) mods.arrowEnch = Math.max(mods.arrowEnch, lv);
          else mods.ench = Math.max(mods.ench, lv);
        } else if (d.ammoTag && mods[d.ammoTag] === false) {
          mods[d.ammoTag] = true;
        }
      });
      return mods;
    },

    /* ===== 豆包v167：特殊弹药「附魔一击」框架 =====================================
       普攻永远打普通子弹；特殊弹（附魔 / 灵类 / 神圣 / 银 / 焰、附魔箭）作为战斗中
       可主动点按的单发【魔法攻击】，打一发消耗一颗（见 battle.fireShot），能伤到物理免疫的鬼怪。
       · shotSpec(d)：识别一发弹药的属性与威力档位；返回 null = 普通弹，不做主动一击。
       · 威力与消耗（奖励点 / 附魔等级）挂钩：附魔 +N 倍率随等级升；灵类/神圣是「对策卡」，
         对鬼怪 ghost 有特攻、对寻常血肉 physical 收效很低（灵类弹对血肉几乎无用）。
       以后扩展魔法/科技弹药：给 ITEM_DEF 加 ammoTag（ench/spirit/holy/silver/fire）+ enchLv 即可，
       不必改战斗 UI；若是全新属性，在下面加一个分支并在 battle._hurt 确认其 magic:true。 */
    shotSpec(d){
      if (!d) return null;
      const name = d.name || "";
      const m = /附魔\+?\s*([1-6])/.exec(name);
      const lv = d.enchLv || (m ? parseInt(m[1], 10) : 0) || 0;
      const isArrow = /箭/.test(name);
      const tag = d.ammoTag;
      if (tag === "ench" || lv > 0) {
        const L = lv || 1;
        return { tag:"ench", enchLv:L, forBow:isArrow, magic:true, label:"附魔+"+L,
          // 倍率随附魔等级（近似随价格上升）：+1≈1.6 … +6≈4.6
          mul:1 + L*0.6, hit:0.05, vsGhost:1.25, vsPhys:1.0, tone:"魔",
          desc:"附魔一击（魔法伤害，可伤灵体）" };
      }
      if (tag === "spirit")
        return { tag:"spirit", forBow:false, magic:true, label:"灵弹", mul:1.0, hit:0.08,
          vsGhost:3.4, vsPhys:0.15, tone:"灵", desc:"灵类特攻：对鬼怪伤害极高，对血肉几乎无效" };
      if (tag === "holy")
        return { tag:"holy", forBow:false, magic:true, label:"神圣", mul:1.7, hit:0.06,
          vsGhost:2.4, vsPhys:1.1, tone:"圣", desc:"神圣特攻：对邪恶 / 灵体强效" };
      if (tag === "silver")
        return { tag:"silver", forBow:false, magic:true, label:"银弹", mul:1.25, hit:0.0,
          vsGhost:1.7, vsPhys:0.95, tone:"银", desc:"硝酸银：对邪秽灵体有效" };
      if (tag === "fire")
        return { tag:"fire", forBow:false, magic:true, label:"焰弹", mul:1.3, hit:0.0,
          vsGhost:1.4, vsPhys:1.15, tone:"焰", desc:"附魔焰弹：超自然火焰，可伤灵体" };
      return null;
    },
    // 当前装备的枪/弓可主动发射的特殊弹（按背包实有数量，逐个生成战斗按钮配置）
    enchShots(){
      const p = WK.P; if (!p || !p.equip || !p.equip.weapon) return [];
      const wdef = WK.ITEM_DEF[p.equip.weapon];
      const kind = this.wepKind(wdef);              // ranged | bow | melee | unarmed
      if (kind !== "ranged" && kind !== "bow") return [];
      const items = p.items || {}; const out = []; const seen = {};
      Object.keys(items).forEach(id => {
        if (!(items[id] > 0) || seen[id]) return;
        const d = WK.ITEM_DEF[id]; if (!d) return;
        const s = this.shotSpec(d); if (!s) return;
        if (kind === "bow" && !s.forBow) return;    // 弓只射附魔箭
        if (kind === "ranged" && s.forBow) return;  // 枪不射箭
        seen[id] = 1;
        out.push(Object.assign({ id:id, name:d.name, count:items[id] }, s));
      });
      return out;
    },
    // 判断某件投掷物 / 符咒的攻击是否带超自然（魔法）属性——只有魔法攻击才伤得了鬼怪
    itemIsMagic(id){
      const d = id && WK.ITEM_DEF && WK.ITEM_DEF[id]; if (!d) return false;
      if (d.ammoTag && ["ench","spirit","holy","silver","fire"].indexOf(d.ammoTag) >= 0) return true;
      if (d.kind === "charm") return true;
      return /圣|神|附魔|灵类|驱邪|符咒|法符/.test(d.name || "");
    },

    bloodBonus(bl){
      const out = { atk:0, hit:0, crit:0, maxHp:0, chargeSpd:0, energy:null };
      if (!bl) return out;
      if (bl.bodyPts) {
        out.atk += Math.floor((bl.bodyPts || 0) / 10);
        out.maxHp += Math.floor((bl.bodyPts || 0) / 5);
      }
      // 血统自带攻击 / 特殊能量
      if (bl.innateAtk) out.atk += bl.innateAtk;
      if (bl.energyType) out.energy = bl.energyType; // 如 blood = 血族能量
      (bl.traits || []).forEach(t => {
        const def = (WK.BLOOD_TRAITS || {})[t];
        if (!def || !def.stats) return;
        Object.keys(def.stats).forEach(k => { out[k] = (out[k] || 0) + def.stats[k]; });
      });
      return out;
    },

    equipPieces(equip){
      equip = equip || {};
      const pieces = {};
      ["weapon","armor","accessory","ring"].forEach(slot => {
        const id = equip[slot];
        if (!id) return;
        const d = WK.ITEM_DEF && WK.ITEM_DEF[id];
        if (d) pieces[slot] = { id, def: d };
      });
      return pieces;
    },

    /* 核心：任意 actor → 战斗档案 */
    profile(actor){
      actor = actor || this.actorPlayer();
      const a = actor.attrs || { mus:100, ner:100, cel:100, int:100, spi:100, imm:100 };
      const pieces = this.equipPieces(actor.equip);
      const wDef = pieces.weapon && pieces.weapon.def;
      const kind = this.wepKind(wDef);
      const bl = this.bloodBonus(actor.bloodline);
      const ammo = this.ammoMods(actor.items);

      // —— 六维基础攻击（无武器时的「拳头/默认识枪」）——
      let baseAtk = 14 + (a.mus - 100) * 0.12 + bl.atk;
      if (actor.templateAtk != null && !wDef) {
        // 队友无装备时略向模板靠拢，避免反推误差
        baseAtk = baseAtk * 0.35 + actor.templateAtk * 0.65;
      }
      baseAtk = Math.max(6, baseAtk);

      let hit = 0.05 + (a.ner - 100) * 0.0015 + bl.hit;
      let crit = 0.05 + (a.ner - 100) * 0.001 + bl.crit;
      // 豆包v165：科技功能道具临时增益（玩家档携带 buffs；敌人/队友无此字段）
      if (actor.buffs) {
        const nowTs = Date.now();
        if ((actor.buffs.gadgetSight || 0) > nowTs) { hit += 0.08; crit += 0.03; }   // 夜视/照明
        if ((actor.buffs.gadgetScan || 0) > nowTs)  { hit += 0.10; crit += 0.05; }   // 战术扫描/战斗分析
      }
      let armor = 0, shield = 0, maxHpBonus = bl.maxHp || 0;
      let chargeSpd = 1 + (bl.chargeSpd || 0);

      // 防具/饰品/戒指数值（护盾值按装备表价格生成，可吸收伤害）
      ["armor","accessory","ring"].forEach(slot => {
        const d = pieces[slot] && pieces[slot].def;
        if (!d || !d.stats) return;
        const st = d.stats;
        if (st.atk) baseAtk += st.atk;
        if (st.hit) hit += st.hit;
        if (st.crit) crit += st.crit;
        if (st.armor) armor += st.armor;
        if (st.shield) shield += st.shield;
        if (st.maxHp) maxHpBonus += st.maxHp;
        if (st.chargeSpd) chargeSpd += st.chargeSpd;
        if (st.attrsBoost) {
          // 贵族圆环等：穿戴时临时加六维（只影响本场 profile）
          const ab = st.attrsBoost;
          if (ab.mus) a.mus = (a.mus || 100) + ab.mus;
          if (ab.ner) a.ner = (a.ner || 100) + ab.ner;
          if (ab.spi) a.spi = (a.spi || 100) + ab.spi;
          if (ab.int) a.int = (a.int || 100) + ab.int;
          if (ab.cel) a.cel = (a.cel || 100) + ab.cel;
          if (ab.imm) a.imm = (a.imm || 100) + ab.imm;
        }
      });

      // 武器
      let dmgMin = null, dmgMax = null, wepAtk = 0, wepName = "徒手";
      // 豆包v178：纳戒裹能——徒手 + 戒指槽戴着纳戒 + 体内有任一能量时，拳头裹能量可伤灵体（郑吒式）
      const naring = this._naringPunch(actor, pieces, wDef);
      if (naring) wepName = "纳戒裹能";
      if (wDef) {
        wepName = wDef.name || "武器";
        const st = wDef.stats || {};
        if (kind === "melee") {
          wepAtk = st.atk || 0;
          baseAtk += wepAtk;
          if (st.hit) hit += st.hit;
          if (st.crit) crit += st.crit;
          // 近战集气：综合六维，偏肌肉与神经
          chargeSpd *= (0.85 + 0.15 * ((a.mus + a.ner) / 200));
        } else if (kind === "ranged" || kind === "bow") {
          // 远程：浮动伤害区间；未写 min/max 时用 atk 推算
          const mid = st.atk || 10;
          dmgMin = st.dmgMin != null ? st.dmgMin : Math.max(4, Math.round(mid * 0.55));
          dmgMax = st.dmgMax != null ? st.dmgMax : Math.round(mid * 1.45 + 6);
          if (st.hit) hit += st.hit;
          if (st.crit) crit += st.crit;
          // 换弹/举枪：神经 + 肌肉
          chargeSpd *= (0.75 + 0.25 * ((a.ner * 0.6 + a.mus * 0.4) / 100));
          // 豆包v167：魔法类特殊弹（灵类/银/焰/神圣/附魔弹、附魔箭）不再「持有即全局加成」，
          //   改为战斗中主动点按的「附魔一击」（combat.shotSpec/enchShots + battle.fireShot），
          //   一发消耗一颗，普攻始终打普通子弹。这里仅保留三类纯物理升级弹的常驻手感：
          if (ammo.uranium) { dmgMin = Math.round(dmgMin * 1.12); dmgMax = Math.round(dmgMax * 1.12); /* 贫铀穿甲，上下限齐抬 */ }
          if (ammo.uv) { crit += 0.05; /* 紫外线：对怕光的 BOW 弱点打击 */ }
          if (ammo.hi) { hit += 0.06; dmgMax = Math.round(dmgMax * 1.06); /* 高科技弹：自校正弹道 */ }
        }
      } else {
        // 徒手/默认识枪：略吃神经
        chargeSpd *= (0.9 + 0.1 * (a.ner / 100));
      }

      // 被动技能（射击精通等）
      if (actor.skills && actor.skills.shoot_mastery) {
        hit += 0.08; crit += 0.10;
      }

      // 集气满所需毫秒（基准 3200ms，chargeSpd 越大越快）
      const chargeMs = Math.max(900, Math.round(3200 / Math.max(0.4, chargeSpd)));

      return {
        id: actor.id, name: actor.name, isPlayer: !!actor.isPlayer,
        kind, wepName, wepAtk,
        baseAtk: Math.round(baseAtk * 10) / 10,
        dmgMin, dmgMax,
        hit: Math.max(0, hit), crit: Math.max(0, crit),
        armor, maxHpBonus, chargeSpd, chargeMs,
        ammo, energyType: bl.energy,
        // 豆包v169：装备的是魔法兵器（魔法剑/法杖/射影机）时，普攻也算魔法攻击，可伤灵体
        // 豆包v178：纳戒裹能同样计入（徒手+纳戒+能量），见 _naringPunch
        magicWeapon: !!(wDef && wDef.magicWeapon) || naring,
        naring: !!naring,
        // 兼容旧调用
        atk: Math.round(baseAtk),
      };
    },
    /* 豆包v178：纳戒裹能判定——仅玩家、未装备武器、戒指槽戴着纳戒、体内任一种能量 > 0 时为真 */
    _naringPunch(actor, pieces, wDef){
      if (!actor || !actor.isPlayer || wDef) return false;
      const ring = pieces && pieces.ring;
      if (!ring || ring.id !== "ring_naring") return false;
      const p = WK.P;
      if (!p || !WK.Blood || !WK.Blood.energySources) return false;
      const src = WK.Blood.energySources(p);
      for (const k in src) { const e = src[k]; if (e && e.cur > 0) return true; }
      return false;
    },

    /* 兼容旧 UI：玩家当前 stats */
    stats(){ const p = this.profile(this.actorPlayer()); return p; },
    equipBonus(){
      const p = WK.P, out = { atk:0, hit:0, crit:0, armor:0, maxHp:0, chargeSpd:0 };
      if (!p || !p.equip) return out;
      ["weapon","armor","accessory","ring"].forEach(slot => {
        const id = p.equip[slot]; if (!id) return;
        const d = WK.ITEM_DEF[id]; if (!d || !d.stats) return;
        Object.keys(d.stats).forEach(k => { out[k] = (out[k]||0) + (d.stats[k]||0); });
      });
      return out;
    },

    /* 结算一击。返回 { miss, crit, dmg, text, headshot } */
    rollAttack(prof, enemyDef, opts){
      opts = opts || {};
      const skill = opts.skill || null;
      const shot = opts.shot || null;   // 豆包v167：附魔一击的特殊弹规格（shotSpec），无则普通攻击
      const dodge = enemyDef
        ? (enemyDef.speed === "极快" ? 0.22 : enemyDef.speed === "快" ? 0.12 : 0.05)
        : 0.05;
      let hitChance = 0.50 + (prof.hit || 0) + 0.12 - dodge; // 0.12 近距离交火
      if (skill && skill.hit) hitChance += skill.hit;
      if (shot && shot.hit) hitChance += shot.hit;          // 特殊弹略稳（附魔/灵类专门调校）
      // 光环仅玩家吃
      if (prof.isPlayer && WK.party) hitChance += (WK.party.aura().hit || 0);
      hitChance = Math.max(0.05, Math.min(0.97, hitChance));

      if (Math.random() > hitChance) {
        return { miss: true, dmg: 0, crit: false, text: prof.name + " 未命中" };
      }

      let critChance = Math.max(0, Math.min(0.98, 0.10 + (prof.crit || 0) + ((skill && skill.crit) || 0)));
      const crit = Math.random() < critChance;

      let raw;
      // v162：血统技能 = 基础值 + 主角能力 × 倍率（倍率保守，基因锁后再抬）
      if (skill && (skill.mult != null || skill.powerStat)) {
        let ba = (opts.attrs) || (prof.attrs) || (prof.isPlayer && WK.GeneLock && WK.GeneLock.effectiveAttrs && WK.GeneLock.effectiveAttrs(WK.P)) || (prof.isPlayer && WK.P && WK.P.attrs) || { mus:100, ner:100, int:100, spi:100, cel:100, imm:100 };
        const ps = skill.powerStat || "mus";
        let power = 0;
        if (ps === "phys") power = ((ba.mus||100)+(ba.ner||100))/2;
        else if (ps === "mind") power = ((ba.spi||100)+(ba.int||100))/2;
        else if (ps === "body") power = ((ba.cel||100)+(ba.imm||100))/2;
        else if (ps === "atk") power = (prof.baseAtk || 14) * 8;
        else power = ba[ps] || 100;
        let lineScale = 1;
        if (prof.isPlayer && WK.Blood && skill.lineScaleFromBlood && WK.Blood.skillLineScale) {
          lineScale = WK.Blood.skillLineScale(skill) || 1;
        }
        const mult = (skill.mult != null ? skill.mult : 0.10) * lineScale;
        const base = skill.base != null ? skill.base : 8;
        raw = base + power * mult;
        raw *= (0.92 + Math.random() * 0.16);
      } else if (skill && skill.base != null && opts.forceSkillBase) {
        raw = skill.base * (1 + 0.30 * (((prof.baseAtk || 14) - 14) / 14));
      } else if (prof.kind === "ranged" || prof.kind === "bow") {
        const aim = Math.max(0, Math.min(1, 0.35 + (prof.hit || 0) * 2.2 + (crit ? 0.15 : 0)));
        const lo = prof.dmgMin != null ? prof.dmgMin : Math.round(prof.baseAtk * 0.6);
        const hi = prof.dmgMax != null ? prof.dmgMax : Math.round(prof.baseAtk * 1.5);
        raw = lo + (hi - lo) * aim * (0.85 + Math.random() * 0.2);
        if (shot) raw *= shot.mul;     // 豆包v167：特殊弹倍率（附魔等级/价格），在减甲前生效
      } else {
        raw = (prof.baseAtk || 14) * (0.85 + Math.random() * 0.3);
      }
      if (skill && skill.base != null && skill.mult == null && !opts.forceSkillBase) {
        raw = raw * 0.70 + (skill.base * 0.30) * (1 + Math.max(0, (prof.baseAtk || 14) - 14) * 0.015);
      }
      if (crit) raw *= (skill && skill.critMult) || (prof.kind === "ranged" ? 1.9 : 1.7);

      let dmg = Math.max(1, Math.round(raw - ((enemyDef && enemyDef.armor) || 0) * 4));
      // 玩家护甲不减自己输出；敌方护甲已在上式

      let text = prof.wepName && prof.wepName !== "徒手"
        ? (prof.name + " 的" + prof.wepName + (crit ? " 暴击" : "") + " -" + dmg)
        : (prof.name + (crit ? " 暴击" : " 命中") + " -" + dmg);
      if (shot) text += "〔" + shot.label + "〕";

      // 豆包v167：magic 标记给 battle._hurt 判断能否伤到鬼怪；tag/vsGhost/vsPhys 供 fireShot 做类型修正
      return { miss: false, crit, dmg, text, magic: !!(shot && shot.magic), shot: shot,
        headshot: crit && !(enemyDef && (enemyDef.id === "crawler" || enemyDef.armor >= 2)) };
    },

    wear(id){
      const p = WK.P; if (!p) return false;
      const d = WK.ITEM_DEF[id]; if (!d) { WK.toast("未知装备","bad"); return false; }
      const slot = this.slotOf(id); if (!slot) { WK.toast("这件不能装备","bad"); return false; }
      if (!(p.items && p.items[id] > 0)) { WK.toast("背包里没有这件","bad"); return false; }
      p.equip = p.equip || { weapon:null, armor:null, accessory:null, ring:null };
      p.equip[slot] = id;
      WK.save.write();
      WK.toast("已装备「" + d.name + "」", "gold");
      return true;
    },
    unwear(slot){
      const p = WK.P; if (!p || !p.equip) return false;
      const id = p.equip[slot]; if (!id) return false;
      p.equip[slot] = null;
      WK.save.write();
      WK.toast("已卸下「" + ((WK.ITEM_DEF[id]||{}).name||id) + "」", "gold");
      return true;
    }
  };

  /* 豆包v175：特质数值表——stats 由 combat.bloodBonus 聚合进战斗档案（只放数值向效果）。
     纯机制类（各系免疫 / 魔法抗性 / 致命留血 / 吸血 / 减伤 / 再生）不在此，由战斗钩子按 trait key 判定。 */
  WK.BLOOD_TRAITS = {
    body_boost: { name:"身体强化", stats:{ atk:3 }, desc:"被动小幅提高身体素质" },
    phys_resist:{ name:"物理抗性", stats:{ armor:2 }, desc:"被动提高对物理伤害的抗性" },
    speed:      { name:"速度", stats:{ chargeSpd:0.08, hit:0.03 }, desc:"被动提高速度与命中" },
    recover:    { name:"恢复", stats:{ maxHp:10 }, desc:"细胞活力与恢复提升" },
    blood_fang: { name:"血族之牙", stats:{ atk:5, hit:0.04 }, desc:"近战吸血潜力（技能侧实装）" },
    // —— v175 数值向特质 ——
    night_boost:  { name:"暗夜亲和", stats:{ hit:0.04, crit:0.02 }, desc:"黑暗中更精准" },
    night_fighter:{ name:"暗夜作战", stats:{ hit:0.05, crit:0.03 }, desc:"夜间作战命中暴击提升" },
    sharpshoot:   { name:"精准之眼", stats:{ hit:0.06, crit:0.04 }, desc:"远程专精，命中暴击提升" },
    psychic:      { name:"强韧精神", stats:{ hit:0.03, crit:0.02 }, desc:"精神凝聚，出手更稳" },
    swift:        { name:"迅捷", stats:{ chargeSpd:0.08, hit:0.03 }, desc:"集气与出手更快" },
    flyer:        { name:"制空", stats:{ hit:0.02, chargeSpd:0.04 }, desc:"空中机动，出手更快" },
    phys_hardy:   { name:"强韧躯体", stats:{ armor:3, maxHp:40 }, desc:"皮糙肉厚，受伤减免28%" },
    plague_immune:{ name:"不染瘟疫", stats:{ maxHp:15 }, desc:"病毒/感染与毒素对其无效" },
    regen_vampire:{ name:"血族之心", stats:{ maxHp:30 }, desc:"高速再生；心脏未碎时每场首次致命伤保留1血" },
    regen_troll:  { name:"巨魔再生", stats:{ maxHp:20 }, desc:"极快再生断肢" },
    regen_strong: { name:"强再生", stats:{ maxHp:10 }, desc:"伤口快速愈合" }
    // 下列为纯机制标签（无数值），效果在受伤/再生钩子判定：
    // lifesteal 吸血、poison_immune/fire_immune/cold_immune 元素免疫、magic_immune/magic_resist 魔法、
    // photo_synth 光合再生、aquatic 水生、bloodline_power 天赋异能
  };

  WK.battleSkills = function () {
    const owned = [];
    const p = WK.P;
    if (p && p.skills) Object.keys(p.skills).forEach(id => {
      if (WK.SKILL_DEF[id] && owned.indexOf(id) < 0) owned.push(id);
    });
    return owned;
  };
  WK.hasRangedWeapon = function () {
    const p = WK.P; if (!p || !p.equip || !p.equip.weapon) return false;
    const d = WK.ITEM_DEF && WK.ITEM_DEF[p.equip.weapon];
    if (!d) return false;
    return d.wepType === "ranged" || d.type === "firearm" || d.kind === "gun";
  };


  /* ============================================================
   * 基因锁 · 一阶（v163）
   * 仅战斗中每秒判定；开启后全属性×3；战后按累计次数惩罚。
   * 存活完成战后流程才计入累计；战死不计入。
   * ============================================================ */
  WK.GeneLock = {
    ensure(p){
      p = p || WK.P;
      if (!p) return null;
      if (!p.geneLock) {
        p.geneLock = {
          opensTotal: 0, active: false, openedThisBattle: false, activeUntil: 0,
          penaltyUntil: 0, penaltyPct: 0, backlashUntil: 0, backlashLastTick: 0, _lastCheck: 0
        };
      }
      return p.geneLock;
    },
    onBattleStart(){
      const gl = this.ensure();
      if (!gl) return;
      gl.active = false;
      gl.openedThisBattle = false;
      gl.activeUntil = 0;
      gl._lastCheck = Date.now();
    },
    durationSec(opensTotal){
      const n = (opensTotal || 0) + 1;
      if (n <= 1) return 30;
      if (n === 2) return 40;
      if (n === 3) return 50;
      if (n === 4) return 60;
      return 70;
    },
    openChance(hp, maxHp){
      if (!maxHp || maxHp <= 0) return 0.0001;
      return (hp / maxHp) >= 0.5 ? 0.0001 : 0.01;
    },
    tickBattle(now){
      const p = WK.P;
      const gl = this.ensure(p);
      if (!gl) return;
      now = now || Date.now();
      const st = WK.battle && WK.battle.state;
      if (gl.active) {
        if (now >= gl.activeUntil) this._endActive(false);
        return;
      }
      if (gl.openedThisBattle) return;
      if (!st || !st.active || st.ended) return;
      if (now - (gl._lastCheck || 0) < 950) return;
      gl._lastCheck = now;
      if (Math.random() < this.openChance(p.hp, p.maxHp)) this._triggerOpen(now);
    },
    _triggerOpen(now){
      const gl = this.ensure();
      now = now || Date.now();
      const sec = this.durationSec(gl.opensTotal);
      gl.active = true;
      gl.openedThisBattle = true;
      gl.activeUntil = now + sec * 1000;
      if (WK.battle && WK.battle._log)
        WK.battle._log("l-crit", "—— 基因锁·一阶 开启！全属性 ×3，持续 " + sec + " 秒 ——");
      if (WK.battle && WK.battle._fxHero) WK.battle._fxHero("基因锁!", "l-crit");
      if (WK.toast) WK.toast("基因锁·一阶开启（" + sec + "秒）", "gold");
    },
    _endActive(fromBattleEnd){
      const gl = this.ensure();
      if (!gl || !gl.active) return;
      gl.active = false;
      gl.activeUntil = 0;
      if (WK.battle && WK.battle._log && !fromBattleEnd)
        WK.battle._log("l-info", "基因锁效果消退，身体重回常态。");
    },
    onBattleWin(){
      const gl = this.ensure();
      if (!gl) return;
      const opened = gl.openedThisBattle;
      this._endActive(true);
      if (!opened) return;
      gl.opensTotal = (gl.opensTotal || 0) + 1;
      const n = gl.opensTotal;
      this._applyPostPenalty(n);
      if (WK.save && WK.save.write) WK.save.write();
      this._showPostSummary(n);
    },
    onBattleDefeat(){
      const gl = this.ensure();
      if (!gl) return;
      this._endActive(true);
      gl.openedThisBattle = false;
    },
    _applyPostPenalty(n){
      const gl = this.ensure();
      const now = Date.now();
      gl.backlashUntil = 0; gl.penaltyPct = 0; gl.penaltyUntil = 0;
      if (n === 1) {
        gl.penaltyPct = 0.50; gl.penaltyUntil = now + 3600 * 1000;
        gl.backlashUntil = now + 100 * 1000; gl.backlashLastTick = now;
      } else if (n === 2) { gl.penaltyPct = 0.40; gl.penaltyUntil = now + 3600 * 1000; }
      else if (n === 3) { gl.penaltyPct = 0.30; gl.penaltyUntil = now + 3600 * 1000; }
      else if (n === 4) { gl.penaltyPct = 0.20; gl.penaltyUntil = now + 3600 * 1000; }
      else if (n === 5) { gl.penaltyPct = 0.10; gl.penaltyUntil = now + 3600 * 1000; }
    },
    _showPostSummary(n){
      // 豆包v166：战后惩罚改为纯后台 debuff + 非阻塞 toast（旧版此处 setTimeout 弹 ov-generic，
      // 与战斗胜利结算窗抢遮罩、挡住地图，玩家表现为「战后没法移动、像干等 100 秒」）。
      // 虚弱 1 小时、首次 100 秒细胞反噬照常计时（tickPenalty / tickBacklash），但全程不锁移动。
      const gl = this.ensure();
      if (n === 1) {
        WK.toast("基因锁·一阶首次开启：1 小时内全属性 -50%，并承受 100 秒细胞反噬（可自由行动）", "bad", 4200);
      } else if (n <= 5) {
        WK.toast("基因锁余波：1 小时内全属性 -" + Math.round((gl.penaltyPct || 0) * 100) + "%（可自由行动）", "bad", 3200);
      } else {
        WK.toast("身体已适应一阶基因锁，本场无战后惩罚", "good", 2600);
      }
    },
    tickBacklash(now){
      const p = WK.P; const gl = this.ensure(p);
      if (!gl || !gl.backlashUntil) return;
      now = now || Date.now();
      if (now >= gl.backlashUntil) {
        gl.backlashUntil = 0;
        if (WK.toast) WK.toast("细胞反噬结束", "good");
        if (WK.save && WK.save.write) WK.save.write();
        return;
      }
      if (now - (gl.backlashLastTick || 0) < 950) return;
      gl.backlashLastTick = now;
      const cel = this.rawCel(p);
      let prob = 0.5 - (cel - 100) * 0.001;
      if (prob < 0.10) prob = 0.10;
      if (prob > 0.90) prob = 0.90;
      if (Math.random() < prob) {
        const dmg = Math.max(1, Math.round((p.maxHp || 100) * 0.10));
        p.hp = Math.max(1, (p.hp || 1) - dmg);
        if (WK.toast) WK.toast("细胞反噬 -" + dmg + " 生命", "bad");
        if (WK.save && WK.save.write) WK.save.write();
      }
    },
    rawCel(p){
      p = p || WK.P;
      let cel = (p.attrs && p.attrs.cel) || 100;
      if (WK.Blood && WK.Blood.totalAttrs) cel += (WK.Blood.totalAttrs(p).cel || 0);
      return cel;
    },
    tickPenalty(now){
      const gl = this.ensure();
      if (!gl) return;
      now = now || Date.now();
      if (gl.penaltyUntil && now >= gl.penaltyUntil) {
        gl.penaltyUntil = 0; gl.penaltyPct = 0;
        if (WK.toast) WK.toast("基因锁属性惩罚已解除", "good");
        if (WK.save && WK.save.write) WK.save.write();
      }
      this.tickBacklash(now);
    },
    isActive(){
      const gl = this.ensure();
      if (!gl || !gl.active) return false;
      if (Date.now() >= gl.activeUntil) { this._endActive(false); return false; }
      return true;
    },
    penaltyMul(){
      const gl = this.ensure();
      if (!gl || !gl.penaltyUntil || Date.now() >= gl.penaltyUntil) return 1;
      return Math.max(0.05, 1 - (gl.penaltyPct || 0));
    },
    effectiveAttrs(p){
      p = p || WK.P;
      const base = (p && p.attrs) || { mus:100, ner:100, int:100, spi:100, cel:100, imm:100 };
      let add = { mus:0, ner:0, int:0, spi:0, cel:0, imm:0 };
      if (WK.Blood && WK.Blood.totalAttrs) add = WK.Blood.totalAttrs(p);
      const lock = this.isActive() ? 3 : 1;
      const pen = this.penaltyMul();
      const out = {};
      ["mus","ner","int","spi","cel","imm"].forEach(function(k){
        out[k] = Math.max(1, Math.round(((base[k] || 100) + (add[k] || 0)) * lock * pen));
      });
      return out;
    },
    statusText(){
      const gl = this.ensure();
      if (!gl) return "";
      const bits = [];
      if (this.isActive())
        bits.push("基因锁×3 " + Math.max(0, Math.ceil((gl.activeUntil - Date.now()) / 1000)) + "s");
      if (gl.penaltyUntil && Date.now() < gl.penaltyUntil)
        bits.push("惩罚-" + Math.round((gl.penaltyPct||0)*100) + "% ~" + Math.ceil((gl.penaltyUntil - Date.now()) / 60000) + "分");
      if (gl.backlashUntil && Date.now() < gl.backlashUntil)
        bits.push("反噬" + Math.ceil((gl.backlashUntil - Date.now())/1000) + "s");
      if (gl.opensTotal) bits.push("累计" + gl.opensTotal + "次");
      return bits.join(" · ");
    }
  };


  WK.battle = {
    state:null, timer:null,
    isBoss(def){ return def.id === "crawler" || def.armor >= 2 || def.atk >= 40; },

    /* —— 开战。roomId：遭遇房间（用于规则/清场冷却）；opts 可覆盖波次与战斗规则 —— */
    start(roomId, opts){
      opts = opts || {};
      if (this.state && this.state.active) return false;
      let wave = opts.wave;
      if (!wave) {
        const rule = WK.Spawner.ruleFor(roomId);
        if (!rule || !WK.Spawner.gateOpen(rule, WK.P.flags)) { WK.log("system", "这里现在没有敌人。"); return false; }
        if (WK.Spawner.inCooldown(roomId)) { WK.log("system", "这里的敌人刚被清掉，还没重新聚集。"); return false; }
        wave = WK.Spawner.roll(roomId, WK.P.flags).wave;
      }
      if (!wave || !wave.length) { WK.log("system", "这里没有敌人。"); return false; }

      const groups = [];
      wave.forEach(w => {
        const def = WK.ENEMIES[w.id]; if (!def) return;
        if (this.isBoss(def)) { for (let i=0;i<w.count;i++) groups.push(this._mkGroup(def,1)); }
        else groups.push(this._mkGroup(def,w.count));
      });
      if (!groups.length) return false;

      this.state = {
        active:true, ended:false, room:roomId, opts:opts,
        groups:groups, speed:1, charge:0, targetIdx:0,
        cds:{}, dodgeUntil:0, zk:0, dk:0, ck:0, infectedThis:false,
        allies:(("allies" in opts) ? opts.allies : WK.party.battleAllies()).map(a => {
          const actor = WK.combat.actorAlly(a);
          const prof = WK.combat.profile(actor);
          return {
            id:a.id, name:a.name, atk:a.atk||14, hit:a.hit||0, crit:a.crit||0,
            hp:a.hp||90, maxHp:a.maxHp||a.hp||90,
            attrs: actor.attrs, equip: actor.equip, bloodline: actor.bloodline, items: actor.items,
            charge: Math.random()*40, // 错开首轮出手
            chargeMs: prof.chargeMs,
            line:a.line||(a.name+"开火"), lastAct:"",
            nextAt:0 // 保留字段兼容；实际用 charge
          };
        }),
        title:opts.title || "遭遇战"
      };
      this._el("bt-title").textContent = this.state.title;
      this._el("bt-flee").style.display = (opts.noFlee ? "none" : "");
      this._el("bt-speed").textContent = "1×";
      this._log("l-info", "遭遇敌人！" + (this.state.allies.length ? (" 队友 "+this.state.allies.map(a=>a.name).join("、")+" 与你并肩。") : ""));
      if (WK.Blood) WK.Blood.syncRes(WK.P);
      if (WK.Blood && WK.Blood.startPassiveRegen) WK.Blood.startPassiveRegen();
      document.getElementById("ov-battle").classList.add("active");
      this.render();
      if (this.timer) clearInterval(this.timer);
      if (WK.GeneLock) WK.GeneLock.onBattleStart();
      this.timer = setInterval(()=>this._tick(), 100);
      return true;
    },
    _mkGroup(def,count){
      const total = def.hp * count;
      return { def:def, count:count, alive:count, hp:total, maxHp:total, per:def.hp,
        boss:this.isBoss(def), nextAt:Date.now()+700+Math.random()*1100 };
    },

    /* —— 主循环：100ms 一拍；2 倍速时每拍推进两个子步 —— */
    _tick(){
      const st = this.state; if (!st || !st.active) return;
      for (let i=0;i<st.speed;i++) this._subStep();
      this.render();
    },
    _subStep(){
      const st=this.state, p=WK.P; if (st.ended) return;
      if (WK.GeneLock) WK.GeneLock.tickBattle(Date.now());
      const now=Date.now();
      const ner = (WK.GeneLock && WK.GeneLock.effectiveAttrs) ? WK.GeneLock.effectiveAttrs(p).ner : ((p.attrs&&p.attrs.ner)||100);
      // 豆包v143：集气满自动普攻（不再要求玩家点「射击」）；技能改为插入技（手动点、耗集气/体力）
      const auraCh=(WK.party?WK.party.aura().charge:0)||0;
      const cSpd = (WK.combat ? WK.combat.stats().chargeSpd : 1) || 1;
      // 豆包v176：玩家倒下后不再集气/普攻，交给在场队友；站着时集气满自动普攻
      if (!st.heroDown) {
        st.charge = Math.min(100, st.charge + (100/3200)*100*(ner/100)*(1+auraCh)*cSpd);
        if (st.charge >= 100 && !st.ended) {
          st.charge = 0;
          this._autoBasic();
          if (this._allDead()) { this._win(); return; }
        }
      }
      // 敌人行动
      st.groups.forEach(g => { if (g.hp>0 && now>=g.nextAt){ this._enemyAttack(g); g.nextAt = now + (g.boss? 1500 : 1300+Math.random()*700); } });
      // 豆包v144：队友与玩家同一套集气——按各自 chargeMs 涨条，满则自动出手
      st.allies.forEach(a => {
        if (st.ended || a.hp <= 0) return;
        const ms = a.chargeMs || 3200;
        a.charge = Math.min(100, (a.charge || 0) + (100 / ms) * 100); // 与玩家同一 _subStep 节拍 100ms
        if (a.charge >= 100) {
          a.charge = 0;
          this._allyAttack(a);
          if (this._allDead()) { this._win(); return; }
        }
      });
      this._regenStamina(now);
    },
    _regenStamina(now){
      const p=WK.P; if (!p.res) p.res={};
      if (p.res.stamina===undefined) p.res.stamina=60;
      const cap=(p.res&&p.res.maxStamina)||60;
      p.res.stamina=Math.min(cap, (p.res.stamina||0)+0.35);
      // v162：战斗内按能量上限百分比回复（与非战斗同一套公式）
      if (WK.Blood && WK.Blood.regenAll) WK.Blood.regenAll(0.004, true);
    },

    
    /* v157：手动挥拳（纯六维，不吃枪械模板） */
    manualPunch(){
      const st=this.state; if(!st||st.ended) return;
      let gi=st.targetIdx;
      if(!st.groups[gi] || st.groups[gi].hp<=0) gi=st.groups.findIndex(g=>g.hp>0);
      if(gi<0) return;
      st.targetIdx=gi;
      const g=st.groups[gi];
      const actor=WK.combat.actorPlayer();
      // 临时去掉武器，强制徒手档案
      const saved=actor.equip && actor.equip.weapon;
      if (actor.equip) actor.equip = Object.assign({}, actor.equip, { weapon: null });
      const prof=WK.combat.profile(actor);
      if (actor.equip && saved) actor.equip.weapon = saved;
      const r=WK.combat.rollAttack(prof, g.def, {});
      if(r.miss){ this._fx(g,"MISS","l-info"); this._log("","你一拳落空。"); return; }
      const hrP=this._hurt(g,r.dmg,{magic:!!prof.magicWeapon});   // 豆包v167：拳脚默认纯物理；v178：纳戒裹能时为魔法攻击、可伤灵体
      if(hrP.blocked){ this._ghostBlock(g,"你的拳头"); return; }
      this._fx(g,"-"+hrP.dealt, r.crit?"l-crit":"l-hit");
      this._log(r.crit?"l-crit":"","你挥拳打中"+g.def.name+(r.crit?"（要害）":"")+"，"+hrP.dealt+" 点。");
      if(this._allDead()) this._win();
    },
    /* v157：手动开枪（必须装备枪械，伤害吃武器模板） */
    manualShoot(){
      const st=this.state; if(!st||st.ended) return;
      if(!WK.hasRangedWeapon()){ this._log("l-info","没有装备枪械。"); return; }
      // 与自动普攻同一套
      this._autoBasic();
    },

/* —— 豆包v143：集气满自动普攻（用 shoot 定义，伤害吃 combat.stats）—— */
    _autoBasic(){
      const st=this.state; if(!st||st.ended) return;
      let gi=st.targetIdx;
      if(!st.groups[gi] || st.groups[gi].hp<=0) gi=st.groups.findIndex(g=>g.hp>0);
      if(gi<0) return;
      st.targetIdx=gi;
      const g=st.groups[gi];
      const prof=WK.combat.profile(WK.combat.actorPlayer());
      // 豆包v169：装备魔法兵器（魔法剑/法杖/射影机）或「附魔粉尘」生效期间，普攻也算魔法，可伤灵体
      const _pb=(WK.P && WK.P.buffs)||{};
      const magicAtk = !!prof.magicWeapon || (_pb.enchantUntil||0) > Date.now();
      // 普通丧尸远程暴击 → 爆头即杀（与旧手感对齐）
      const r=WK.combat.rollAttack(prof, g.def, {});
      if(r.miss){ this._fx(g,"MISS","l-info"); this._log("","你一击落空。"); return; }
      // 豆包v167：普通子弹/拳脚是纯物理，打灵体直接免疫；v169 魔法武器/临时附魔则可伤到鬼怪
      if(!magicAtk && g.def && g.def.foeType==="ghost"){
        this._ghostBlock(g, prof.kind==="ranged"||prof.kind==="bow" ? "普通子弹" : "你的攻击");
        return;
      }
      if(!g.boss && r.crit && (prof.kind==="ranged"||prof.kind==="unarmed")){
        this._hurt(g,g.per,{magic:magicAtk});
        this._fx(g,"爆头!","l-crit"); this._log("l-crit","爆头！一只"+g.def.name+"倒地。");
        if(this._allDead()) this._win();
        return;
      }
      const hrA=this._hurt(g,r.dmg,{magic:magicAtk});
      this._fx(g,"-"+hrA.dealt, r.crit?"l-crit":"l-hit");
      this._log(r.crit?"l-crit":"l-hit", r.text+" → "+g.def.name);
    },

    /* ===== 豆包v167：附魔一击（主动特殊弹）====================================
       装备枪械/弓弩后，战斗道具栏上方出现特殊弹按钮；点一下打出一发【魔法攻击】，
       打一发消耗一颗（不耗集气，和扔手雷一样属于道具出手，敌人攻击计时照常）。
       普攻打不动的鬼怪，只能靠这里的附魔/灵类/神圣弹（或驱邪符咒）解决。 */
    fireShot(id){
      const st=this.state; if(!st||st.ended) return;
      const shot=WK.combat.enchShots().find(s=>s.id===id);
      if(!shot){ this._log("l-info","当前武器用不了这种弹药（枪械射子弹、弓弩射箭）。"); return; }
      if(!WK.inv.count(id)){ this._log("l-info","「"+shot.name+"」用完了。"); this.render(); return; }
      let gi=st.targetIdx;
      if(!st.groups[gi] || st.groups[gi].hp<=0) gi=st.groups.findIndex(g=>g.hp>0);
      if(gi<0){ this._win(); return; }
      st.targetIdx=gi; const g=st.groups[gi];
      const prof=WK.combat.profile(WK.combat.actorPlayer());
      const r=WK.combat.rollAttack(prof, g.def, { shot:shot });
      // 无论命中与否，这发特殊弹都已上膛击发 → 消耗一颗（infinite 款除外）
      if(!((WK.ITEM_DEF[id]||{}).infinite)){ WK.inv.remove(id,1); WK.save.write(); }
      if(r.miss){
        this._fx(g,"MISS","l-info");
        this._log("","你压进一发「"+shot.name+"」扣下扳机，却偏了。");
        this.render(); return;
      }
      // 类型修正：灵体吃 vsGhost 倍率，血肉吃 vsPhys（灵类弹对血肉收效甚微）
      const isGhost=g.def.foeType==="ghost";
      const mul=isGhost?shot.vsGhost:shot.vsPhys;
      const dmg=Math.max(1, Math.round(r.dmg*mul));
      const hr=this._hurt(g,dmg,{magic:true});   // 特殊弹皆为魔法攻击 → 可伤灵体
      if(hr.blocked){ this._ghostBlock(g,shot.name); this.render(); return; }
      let tail="";
      if(isGhost) tail=(shot.tag==="spirit"||shot.tag==="holy")?" 特攻！":"";
      else if(shot.tag==="spirit") tail="（灵类弹对血肉收效甚微）";
      this._fx(g, shot.label+" -"+hr.dealt, "l-crit");
      this._log("l-crit","你打出一发「"+shot.name+"」，"+(isGhost?"超自然的力量狠狠贯入灵体":"命中"+g.def.name)+" -"+hr.dealt+tail+"。");
      if(this._allDead()){ this.render(); this._win(); return; }
      this.render();
    },

    /* 豆包v167：驱邪符咒（只对鬼怪有效的对策卡，如「一次性恶意护身符」）。
       场上没有灵体 → 提示并不消耗；对鬼怪造成一次神圣魔法伤害。
       「一次性」款用后即焚；高阶（可重复）护身符不消耗，但本场有 6 秒冷却，避免每帧连发。 */
    _useCharm(id){
      const st=this.state; if(!st||st.ended) return;
      const d=WK.inv.def(id)||{}; const name=d.name||"护身符";
      if(!WK.inv.count(id)){ this._log("l-info","没有「"+name+"」了。"); return; }
      const gi=st.groups.findIndex(g=>g.hp>0 && g.def && g.def.foeType==="ghost");
      if(gi<0){ this._log("l-info","「"+name+"」只对鬼怪类存在有效；眼前都是血肉之躯，先收起来。"); return; }
      const disposable=!!d.disposable || /一次性/.test(name);
      if(!disposable){
        const now=Date.now();
        if(st.charmUntil && now<st.charmUntil){ this._log("l-info","护身符的灵光还在凝聚（冷却中）。"); return; }
        st.charmUntil=now+6000;
      }
      const g=st.groups[gi];
      // 威力与价格挂钩：一次性恶意护身符(10点)≈驱退重击150；可重复高阶符按价格抬
      const dmg=Math.round((d.stats&&d.stats.dmg) || (disposable?150:(120+(d.price||1000)*0.06)));
      const hr=this._hurt(g,dmg,{magic:true});
      if(disposable){ WK.inv.remove(id,1); WK.save.write(); }
      this._fx(g,"驱邪 -"+hr.dealt,"l-crit");
      this._log("l-crit","你捏碎「"+name+"」，一道圣洁灵光炸开，"+g.def.name+"被震得扭曲后退 -"+hr.dealt+(disposable?"（护身符化为飞灰）":"")+"。");
      if(this._allDead()){ this.render(); this._win(); return; }
      this.render();
    },

    /* ===== 豆包v169：卷轴法术 / 临时增益 ====================================
       卷轴：解开即施放的一次性魔法。攻击卷轴对当前目标造成 scrollDmg 点【魔法伤害】
       （鬼怪/血肉都吃）；结界/守护/治愈类已在落库时归 heal，走 _battleHeal 回血。
       增益道具：真视药水=短时命中/暴击（复用 gadgetSight）；附魔粉尘=一段时间内
       连普通攻击都带魔法（p.buffs.enchantUntil，见 _autoBasic），可临时硬打灵体。 */
    _castScroll(id){
      const st=this.state; if(!st||st.ended) return;
      const d=WK.inv.def(id)||{}; const name=d.name||"卷轴";
      if(!WK.inv.count(id)){ this._log("l-info","「"+name+"」没有了。"); return; }
      let gi=st.targetIdx;
      if(!st.groups[gi] || st.groups[gi].hp<=0) gi=st.groups.findIndex(g=>g.hp>0);
      if(gi<0){ this._log("l-info","眼前没有可施放的目标。"); return; }
      st.targetIdx=gi; const g=st.groups[gi];
      const dmg=Math.max(20, Math.round(d.scrollDmg||100));
      const hr=this._hurt(g,dmg,{magic:true});
      WK.inv.remove(id,1); WK.save.write();
      if(hr.blocked){ this._ghostBlock(g,name); this.render(); return; }
      this._fx(g,"法术 -"+hr.dealt,"l-crit");
      this._log("l-crit","你解开「"+name+"」，超自然的力量裹挟着咒文轰向"+g.def.name+" -"+hr.dealt+"（卷轴化为灰烬）。");
      if(this._allDead()){ this.render(); this._win(); return; }
      this.render();
    },
    _useBuff(id){
      const st=this.state; if(!st||st.ended) return;
      const d=WK.inv.def(id)||{}; const name=d.name||"道具"; const p=WK.P;
      if(!WK.inv.count(id)){ this._log("l-info","「"+name+"」没有了。"); return; }
      const now=Date.now(); p.buffs=p.buffs||{};
      if(d.buffKind==="sight"){
        p.buffs.gadgetSight=now+600*1000;
        this._log("l-good","你用了「"+name+"」，目光变得通透——接下来 10 分钟可洞穿隐匿，命中/暴击提升。");
      } else if(d.buffKind==="enchant"){
        p.buffs.enchantUntil=Math.max(p.buffs.enchantUntil||0, now)+300*1000;
        this._log("l-good","你把「"+name+"」洒在武器上，淡淡的魔法光晕流转——接下来 5 分钟普通攻击也带魔力，可伤灵体。");
      } else if(d.buffKind==="invincible"||d.buffKind==="invisible"){
        // 豆包v172：无敌药水/透明药水——复用闪避窗口（敌人命中率大幅下降），短时间近乎打不到
        st.dodgeUntil=now+(d.buffKind==="invincible"?4000:5000);
        this._log("l-good", d.buffKind==="invincible"
          ? "无敌药水化开，一层力场裹住全身——接下来几秒，攻击几乎擦不到你。"
          : "你整个人淡去、气息收敛，敌人一时无法锁定你。");
      } else if(d.buffKind==="magicward"){
        // 豆包v172：魔免药水（本集敌人多为物理，主要为后续超自然副本准备）
        p.buffs.magicWardUntil=now+30*1000;
        this._log("l-good","魔免药水起效，一层反魔力场护住周身——30 秒内抵御超自然伤害。");
      } else { this._log("l-info","这件道具的增益类型暂未配置。"); return; }
      if(!d.infinite){ WK.inv.remove(id,1); WK.save.write(); }
      this.render();
    },

    /* —— 玩家施放技能（插入技：需集气/体力；普攻已自动）—— */
    use(id){
      const st=this.state, p=WK.P; if(!st||st.ended) return;   // 豆包v141代码审查修复：p 必须在 owned 判定前声明（原在下方 const，TDZ 导致一点技能就 ReferenceError）
      const def=WK.SKILL_DEF[id]; if(!def) return;
      if(def.kind==="passive"){ this._log("l-info","「"+def.name+"」是被动能力，常驻生效，无需施放。"); return; }
      // 豆包v176：玩家已倒下（队友仍在战斗）时不能行动，只能等队友清场或一起倒下
      if(st.heroDown){ this._log("l-hit","你已经倒下，无法行动——全靠队友了。"); return; }
      const owned=WK.DEFAULT_SKILLS.indexOf(id)>=0 || !!(p.skills&&p.skills[id]);
      if(def.locked && !owned){ this._log("l-info","「"+def.name+"」需在主神空间兑换后解锁。"); return; }
      const now=Date.now();
      if(st.cds[id] && now<st.cds[id]) return;
      if(st.charge < (def.charge||0)){ this._log("l-info","集气不足。"); return; }
      const resKey=def.res;
      if(resKey && (p.res[resKey]||0) < def.cost){ this._log("l-info", WK.SKILL_META[def.type].label+"不足。"); return; }

      if(def.kind==="summon"){
        // 豆包v176：召唤技——在本次战斗中追加临时队友（有血有攻，敌人会攻击它，离场即消失）
        if(!this.summon(def.summon)) return;
      } else if(def.kind==="heal"){
        p.hp=Math.min(p.maxHp, p.hp+Math.round(p.maxHp*def.heal));
        this._fxHero("+"+Math.round(p.maxHp*def.heal),"l-good");
        this._log("l-good","你快速包扎伤口。");
      } else if(def.kind==="dodge"){
        st.dodgeUntil=now+(def.dodgeMs||3000);
        this._log("l-info", def.type==="blood" ? "你化作蝠群，身形散开。" : "你压低身形进入闪避姿态。");
      } else if(def.kind==="buff"){
        st.buffUntil = now + (def.buffMs || 8000);
        st.buffHit = def.hit || 0;
        st.buffCrit = def.crit || 0;
        st.buffCharge = def.chargeSpd || 0;
        this._log("l-good", "「" + def.name + "」生效。");
        this._fxHero("BUFF","l-good");
      } else {
        // 豆包v145：攻击技能与普攻同一套 rollAttack（六维+装备+血统）
        let gi=st.targetIdx;
        if(!st.groups[gi] || st.groups[gi].hp<=0) gi=st.groups.findIndex(g=>g.hp>0);
        if(gi<0){ this._win(); return; }
        st.targetIdx=gi;
        if(def.tgt==="group") this._hitGroupUnified(st.groups[gi], def);
        else this._hitSingleUnified(st.groups[gi], def);
      }
      if(resKey) {
        // 豆包v173：体力直接扣；其余能量（血统 7 系 + 内力/法力/机甲能）走统一 spend，自动回写底层池/血统槽
        if (resKey === "stamina" || !WK.Blood) p.res[resKey] -= def.cost;
        else WK.Blood.spend(resKey, def.cost);
      }
      st.charge-=(def.charge||0);
      st.cds[id]=now+def.cd;
      if(this._allDead()) this._win();
    },

    /* —— 豆包v135/v139 N20：战斗内道具栏（数据驱动）——
       与技能不同：道具不耗集气与体力，点击瞬间结算，唯一限制是背包数量。
       BATTLE_ITEMS 列出可在战斗舞台使用的道具：投掷物走 throw、回血/回体走 heal。
       战斗是实时的——你用药的这一两秒，敌人的攻击计时不会停，这就是用药的代价。*/
    BATTLE_ITEMS: [
      { id:"frag",     label:"投掷破片手雷", hint:"范围爆破", kind:"throw" },
      { id:"medspray", label:"急救喷雾",     hint:"回血 45%", kind:"heal", res:"hp" },
      { id:"bandage",  label:"军用绷带",     hint:"回血 20%", kind:"heal", res:"hp" },
      { id:"ration",   label:"压缩口粮",     hint:"回体 50%", kind:"heal", res:"sta" }
    ],
    listBattleItems(){
      const p = WK.P;
      const flags = (p && p.itemBattle) || {};
      const seen = {};
      const out = [];
      function push(cfg){
        if (!cfg || !cfg.id || seen[cfg.id]) return;
        // v159：数量为 0 不进列表 → 用完格子直接消失，不占界面
        if (!(WK.inv && WK.inv.count(cfg.id) > 0)) return;
        seen[cfg.id] = 1;
        out.push(cfg);
      }
      (this.BATTLE_ITEMS || []).forEach(push);
      const items = (p && p.items) || {};
      Object.keys(items).forEach(function (id) {
        if (!(items[id] > 0)) return;
        const d = WK.ITEM_DEF[id];
        if (!d) return;
        // 豆包v165：投掷物（大表 27 种手雷/地雷/导弹）天生是战斗道具，默认进战斗道具栏；
        // 其余以 battleUse 为准，玩家仍可在背包里手动开关。
        // 豆包v167：charm（护身符/符咒，对鬼怪的对策卡）也天生进战斗道具栏
        const on = flags[id] != null ? !!flags[id] : (!!d.battleUse || !!d.buffKind || d.kind === "throw" || d.kind === "battle" || d.kind === "charm" || d.kind === "scroll");
        if (!on) return;
        if (seen[id]) return;
        let kind = "heal", res = "hp", hint = "战斗使用";
        if (d.shieldId) { kind = "shield"; hint = "凝结护罩"; }
        else if (d.kind === "charm") { kind = "charm"; hint = "对鬼怪"; }
        else if (d.buffKind) { kind = "buff"; hint = d.buffKind === "enchant" ? "临时附魔" : "真视"; }
        else if (d.kind === "scroll") { kind = "scroll"; hint = d.scrollHeal ? "结界·回复" : "卷轴法术"; }
        else if (d.kind === "throw" || d.kind === "battle") { kind = "throw"; hint = "战术投掷"; }
        else if (d.heal && ((d.heal.sta || d.heal.flatSta != null) && !(d.heal.hp || d.heal.flatHp != null))) { kind = "heal"; res = "sta"; hint = "回体"; }
        else if (d.heal || d.kind === "heal" || d.kind === "food") {
          kind = "heal";
          res = (d.heal && ((d.heal.sta || d.heal.flatSta != null) && !(d.heal.hp || d.heal.flatHp != null))) ? "sta" : "hp";
          hint = "消耗品";
        }
        push({ id: id, label: d.name || id, hint: hint, kind: kind, res: res });
      });
      return out;
    },
    useItem(id){
      const st=this.state; if(!st||st.ended) return;
      const cfg=(this.listBattleItems ? this.listBattleItems() : this.BATTLE_ITEMS).find(x=>x.id===id);
      if(!cfg){ this._log("l-info","该道具未设为战斗使用。"); return; }
      if(!WK.inv.count(id)){ this._log("l-info","没有「"+(WK.inv.def(id)||{}).name+"」了。"); return; }
      if(cfg.kind==="shield"){
        // 豆包v177：凝结耐久护罩（一次性护符激活即消耗；可充能护符不消耗、耗尽后需回主神）
        const r=WK.Shield.activate(id);
        if(r.ok){
          const d=WK.ITEM_DEF[id];
          if(d && d.consumable) WK.inv.remove(id,1);
          WK.save.write();
          this._log("l-good", r.msg);
          this._fxHero("护罩","l-good");
        }else{
          this._log("l-info", r.msg);
        }
        this.render();
      } else if(cfg.kind==="charm"){
        this._useCharm(id);   // 豆包v167：符咒是否消耗由 _useCharm 按「有无鬼怪/是否一次性」决定
      } else if(cfg.kind==="scroll"){
        this._castScroll(id); // 豆包v169：攻击卷轴=一发魔法法术（治疗卷轴归 heal 走 _battleHeal）
      } else if(cfg.kind==="buff"){
        this._useBuff(id);    // 豆包v169：真视药水 / 附魔粉尘等临时增益
      } else if(cfg.kind==="throw"){
        WK.inv.remove(id,1); WK.save.write();
        this._throwFrag(id);
        if(this._allDead()){ this._win(); return; }
        this.render();
      } else if(cfg.kind==="heal"){
        this._battleHeal(id, cfg);
      }
    },
    /* 战斗中用药/进食：瞬间生效、消耗一件；不重置集气（不能用吃药代替攻击），敌人计时照常走 */
    _battleHeal(id, cfg){
      const st=this.state, p=WK.P, d=WK.inv.def(id)||{};
      const heal=d.heal||{};
      let gainTxt=[];
      if(cfg.res==="hp" && heal.hp){
        if(p.hp>=p.maxHp-0.5){ this._log("l-info","生命是满的，先留着 "+d.name+"。"); return; }
        const before=p.hp;
        p.hp=Math.min(p.maxHp, p.hp+p.maxHp*heal.hp);
        gainTxt.push("生命 +"+Math.round(p.hp-before));
      } else if(cfg.res==="hp" && heal.flatHp!=null){
        // 豆包v164【P3】大表药剂：固定点数回血（区别于本世界喷雾的百分比回血）
        if(p.hp>=p.maxHp-0.5){ this._log("l-info","生命是满的，先留着 "+d.name+"。"); return; }
        const before=p.hp;
        p.hp=Math.min(p.maxHp, p.hp+heal.flatHp);
        gainTxt.push("生命 +"+Math.round(p.hp-before));
      } else if(cfg.res==="sta" && heal.sta && p.res){
        if(p.res.stamina>=p.res.maxStamina-0.5){ this._log("l-info","体力是满的，先留着 "+d.name+"。"); return; }
        const before=p.res.stamina;
        p.res.stamina=Math.min(p.res.maxStamina, p.res.stamina+p.res.maxStamina*heal.sta);
        gainTxt.push("体力 +"+Math.round(p.res.stamina-before));
      } else if(cfg.res==="sta" && heal.flatSta!=null && p.res){
        // 豆包v164【P3】大表药剂：固定点数回体
        if(p.res.stamina>=p.res.maxStamina-0.5){ this._log("l-info","体力是满的，先留着 "+d.name+"。"); return; }
        const before=p.res.stamina;
        p.res.stamina=Math.min(p.res.maxStamina, p.res.stamina+heal.flatSta);
        gainTxt.push("体力 +"+Math.round(p.res.stamina-before));
      } else { return; }
      // 豆包v171：战斗中吃下天材地宝，回血之外同样永久涨六维（能走到这里说明没满血、真吃掉了）
      const attrBits = (d.fun && d.attrGain && WK.Fun) ? WK.Fun.applyGain(id) : null;
      if (!d.infinite) WK.inv.remove(id,1); WK.save.write();
      this._log("l-good","你借着闪避的间隙用了「"+d.name+"」，"+gainTxt.join("，")+"。" +
        (attrBits && attrBits.length ? (" 一股精纯药力洗练周身，永久 "+attrBits.map(b=>b.label+" +"+b.n).join("，")+"。") : ""));
      this.render();
    },
    _throwFrag(id){
      // 豆包v165：按投掷物自身 stats.throwDmg 结算（大表 27 种手雷/地雷/导弹各有伤害）；
      // 旧手写 frag 或无数据条目回落到 RULES.fragDamage，保持原手感。
      const tdef = (id && WK.inv.def && WK.inv.def(id)) || {};
      const td = tdef.stats && Number(tdef.stats.throwDmg);
      const st=this.state, base=(td && td>0) ? td : (WK.RULES.fragDamage||120),
        bossMult=WK.RULES.fragBossMult!=null?WK.RULES.fragBossMult:0.6;
      // 豆包v167：神圣/圣水/灵类手雷等超自然爆炸属魔法攻击，可伤灵体；普通破片/燃烧弹打不动鬼怪
      const magic=WK.combat.itemIsMagic(id);
      const label=tdef.name||"手雷";
      let nGroup=0, nBlock=0;
      st.groups.forEach(g=>{
        if(g.hp<=0) return;
        nGroup++;
        const dmg=g.boss?Math.max(1,Math.round(base*bossMult)):base;
        const hr=this._hurt(g,dmg,{magic:magic});   // BOSS 穿甲系数保留；统一走免疫收口
        if(hr.blocked){ nBlock++; this._fx(g,"免疫","l-info"); }
        else this._fx(g,label+" -"+hr.dealt,"l-crit");
      });
      if(!nGroup) this._log("l-crit","你扔出手雷，但前方已经没有站着的目标了。");
      else if(!magic && nBlock===nGroup) this._log("l-info","「"+label+"」的冲击波穿过怨灵半透明的身体，毫无作用——寻常爆炸伤不了灵体。");
      else if(magic) this._log("l-crit","你掷出「"+label+"」，圣洁的冲击轰然炸开，连灵体都被撕出裂痕！");
      else this._log("l-crit","你拉开保险、默数一拍，把「"+label+"」狠狠砸进敌群——轰的一声闷响！");
    },

    /* 豆包v167：敌人受伤害的【唯一收口】。所有让敌人掉血的路径都走这里，
       「鬼怪物理免疫」只在这一处判定，避免散落各处漏判。
       g=敌人组；amount=已命中、已减甲后的伤害点数；o.magic=本次是否超自然攻击
       （附魔/灵类/神圣/魔法技能/符咒）。只负责判定与扣血，不写飘字战报（文案留在调用点）。
       返回 {dealt:实际扣血, blocked:是否被灵体免疫挡下, died:本组是否清空}。 */
    _hurt(g, amount, o){
      o = o || {};
      const st = this.state;
      if (!g || g.hp <= 0) return { dealt:0, blocked:false, died:false };
      const def = g.def || {};
      if (def.foeType === "ghost" && def.physImmune !== false && !o.magic) {
        return { dealt:0, blocked:true, died:false };   // 灵体：纯物理穿过，0 伤害
      }
      const dmg = Math.max(0, Math.round(amount));
      const before = g.alive;
      g.hp = Math.max(0, g.hp - dmg);
      g.alive = this._aliveOf(g);
      if (!g.boss) this._tally(g, before);
      else if (g.hp <= 0) st.ck += 1;
      return { dealt:dmg, blocked:false, died:g.hp <= 0 };
    },
    /* 灵体免疫纯物理时的统一飘字 + 战报；how=这次出手的说法（普通子弹/你的拳头…）*/
    _ghostBlock(g, how){
      this._fx(g, "免疫", "l-info");
      this._log("l-info", (how || "你的攻击") + "穿过" + g.def.name + "半透明的身体，如同打在烟雾里——对灵体毫无作用。");
    },

    /* 豆包N13：被动技能常驻加成汇总（供后续扩展更多 passive）*/
    _passiveBonus(){
      const p=WK.P, sk=p.skills||{}, o={hit:0,crit:0,dmg:0};
      Object.keys(sk).forEach(id=>{ const d=WK.SKILL_DEF[id];
        if(d&&d.kind==="passive"&&d.passive){ o.hit+=d.passive.hit||0; o.crit+=d.passive.crit||0; o.dmg+=d.passive.dmg||0; } });
      return o;
    },
    _hitChance(def,skill){
      const p=WK.P, ner=(p.attrs&&p.attrs.ner)||100;
      const dodge = def.speed==="极快"?0.22 : def.speed==="快"?0.12 : 0.05;
      const auraHit=(WK.party?WK.party.aura().hit:0)||0; // 豆包N7：詹岚观察光环
      const pb=this._passiveBonus(); // 豆包N13：射击精通等被动
      let h=0.50 + 0.22*(ner/100-1) + 0.12 + (skill.hit||0) + auraHit + pb.hit - dodge; // 0.12=本集近距离交火加成
      return Math.max(0.05,Math.min(0.97,h));
    },
    _critChance(skill){ const p=WK.P,ner=(p.attrs&&p.attrs.ner)||100; const pb=this._passiveBonus();
      return Math.max(0,Math.min(0.98, 0.10+0.12*(ner/100-1)+(skill.crit||0)+pb.crit)); },
    _rawDmg(skill){ const p=WK.P,mus=(p.attrs&&p.attrs.mus)||100;
      return (skill.base||0)*(1+0.30*(mus/100-1)); },
    _armorReduce(def,dmg){ return Math.max(1,Math.round(dmg-(def.armor||0)*4)); },

    /* 豆包v145：技能命中统一走 combat.rollAttack */
    _hitSingleUnified(g, skill){
      const st = this.state;
      const prof = WK.combat.profile(WK.combat.actorPlayer());
      // 豆包v167：魔法系技能（道符/法术，skill.magic 或 type==='magic'）算超自然攻击，可伤灵体；其余物理
      const magic = !!(skill && (skill.magic || skill.type === "magic"));
      const r = WK.combat.rollAttack(prof, g.def, { skill: skill });
      if (r.miss) {
        this._fx(g, "MISS", "l-info");
        this._log("", "你的「" + (skill.name || "攻击") + "」落空。");
        return;
      }
      // 远程技能暴击对普通怪：保留爆头即杀手感（魔法/物理都经 _hurt 判定免疫）
      if (!g.boss && r.crit && (prof.kind === "ranged" || skill.type === "firearm") && skill.tgt !== "group") {
        const hh = this._hurt(g, g.per, { magic: magic });
        if (hh.blocked) { this._ghostBlock(g, "「" + skill.name + "」"); return; }
        this._fx(g, "爆头!", "l-crit");
        this._log("l-crit", "「" + skill.name + "」爆头！一只" + g.def.name + "倒地。");
        return;
      }
      const hr = this._hurt(g, r.dmg, { magic: magic });
      if (hr.blocked) { this._ghostBlock(g, "「" + skill.name + "」"); return; }
      this._fx(g, "-" + hr.dealt, r.crit ? "l-crit" : "l-hit");
      this._log(r.crit ? "l-crit" : "l-hit",
        "「" + skill.name + "」" + (r.crit ? "暴击 " : "") + "命中" + g.def.name + " -" + hr.dealt + "。");
      this._lifesteal(hr.dealt);
    },
    /* 豆包v175：血族之牙——命中造成伤害后吸取 8% 生命（仅玩家、需有 lifesteal 特质） */
    _lifesteal(dealt){
      const p = WK.P;
      if (!p || !dealt || !WK.Blood || !WK.Blood.hasTrait(p, "lifesteal")) return;
      if (p.hp <= 0 || p.hp >= p.maxHp) return;
      const heal = Math.max(1, Math.round(dealt * 0.08));
      p.hp = Math.min(p.maxHp, p.hp + heal);
      this._fxHero("+"+heal+" 吸血","l-good");
    },
    _hitGroupUnified(g, skill){
      const st = this.state;
      const prof = WK.combat.profile(WK.combat.actorPlayer());
      const magic = !!(skill && (skill.magic || skill.type === "magic"));
      const n = g.alive;
      let total = 0, hits = 0, blockedAll = true;
      for (let i = 0; i < n; i++) {
        const r = WK.combat.rollAttack(prof, g.def, { skill: skill });
        if (!r.miss) {
          const hh = this._hurt(g, r.dmg, { magic: magic });
          if (!hh.blocked) { total += hh.dealt; hits++; blockedAll = false; }
        }
      }
      if (hits === 0 && g.def && g.def.foeType === "ghost" && !magic) {
        this._ghostBlock(g, "「" + (skill.name || "群攻") + "」"); return;
      }
      this._fx(g, "-" + total + (hits ? (" (" + hits + ")") : ""), "l-hit");
      this._log("l-hit", "「" + (skill.name || "群攻") + "」扫过敌群，命中 " + hits + " 个，共 " + total + " 伤害。");
      this._lifesteal(total);
    },

    _hitSingle(g,skill){
      const p=WK.P, now=Date.now();
      // 豆包v167：旧单体技能通道也统一免疫判定（魔法系技能可伤灵体）
      const magic=!!(skill&&(skill.magic||skill.type==="magic"));
      if(Math.random()>this._hitChance(g.def,skill)){ this._fx(g,"MISS","l-info"); this._log("","你一枪打空。"); return; }
      const crit=Math.random()<this._critChance(skill);
      if(!g.boss && crit){
        // 爆头即杀一只普通丧尸
        const hh=this._hurt(g,g.per,{magic:magic});
        if(hh.blocked){ this._ghostBlock(g,"你的攻击"); return; }
        this._fx(g,"爆头!","l-crit"); this._log("l-crit","爆头！一只"+g.def.name+"倒地。");
      } else {
        let dmg=this._armorReduce(g.def,this._rawDmg(skill)*(crit?(skill.critMult||1.8):1));
        const hr=this._hurt(g,dmg,{magic:magic});
        if(hr.blocked){ this._ghostBlock(g,"你的攻击"); return; }
        this._fx(g,"-"+hr.dealt, crit?"l-crit":"l-hit");
        this._log(crit?"l-crit":"l-hit", (crit?"爆头倍伤！":"")+"你命中"+g.def.name+" -"+hr.dealt+"。");
      }
    },
    _hitGroup(g,skill){
      // 整组：对每只存活者独立判定命中（不爆头，稳定清群）；魔法属性由 skill 决定
      const n=g.alive; const magic=!!(skill&&(skill.magic||skill.type==="magic"));
      let total=0,hits=0;
      for(let i=0;i<n;i++){ if(Math.random()<=this._hitChance(g.def,skill)){ const hh=this._hurt(g,this._armorReduce(g.def,this._rawDmg(skill)),{magic:magic}); if(!hh.blocked){ total+=hh.dealt; hits++; } } }
      if(hits===0 && g.def && g.def.foeType==="ghost" && !magic){ this._ghostBlock(g,"你的攻击"); return; }
      this._fx(g,"-"+total+(hits?(" ("+hits+")"):""),"l-hit");
      this._log("l-hit","三连射扫过敌群，命中 "+hits+" 个。");
    },
    _aliveOf(g){ return g.hp<=0?0:Math.max(1,Math.ceil(g.hp/g.per)); },
    /* 豆包v138 N19：非 BOSS 倒地分流——丧尸犬(kind=zombiedog)计 st.dk，其余感染体计 st.zk；BOSS 死亡由调用方计 ck */
    _tally(g, beforeAlive){
      const n=Math.max(0,(beforeAlive||0)-g.alive);
      if(n<=0) return;
      if(g.def && g.def.kind==="zombiedog") this.state.dk+=n; else this.state.zk+=n;
    },

    /* 豆包v176：仍存活的队友（含召唤物） */
    _liveAllies(){ return this.state.allies.filter(a=>a.hp>0); },

    /* 豆包v176：敌人不再只揍玩家——每次命中在【玩家 + 在场队友（郑吒/詹岚等）+ 召唤物】间随机选目标。
       玩家倒下但还有队友站着时不判负，要玩家与全体队友都倒下才 _defeat（修 A 线舔食者：自己一死就结束）。 */
    _enemyAttack(g){
      const st=this.state, now=Date.now();
      const n=g.boss?1:Math.min(g.alive, Math.random()<0.35?2:1);
      for(let i=0;i<n;i++){
        if(st.ended) return;
        const p=WK.P;
        const heroAlive = p.hp>0 && !st.heroDown;
        const pool=[];
        if(heroAlive) pool.push({t:"hero"});
        st.allies.forEach(a=>{ if(a.hp>0) pool.push({t:"ally",a:a}); });
        if(!pool.length){ this._defeat(); return; }
        // 基础命中（按敌人速度）；闪避姿态对所有目标减半
        let base=g.def.speed==="极快"?0.90:g.def.speed==="快"?0.72:0.58;
        if(now<st.dodgeUntil) base*=0.35;
        const dmg=Math.max(1,Math.round(g.def.atk*(0.85+Math.random()*0.3)));
        const pick=pool[Math.floor(Math.random()*pool.length)];
        if(pick.t==="hero"){
          const ner=(p.attrs&&p.attrs.ner)||100;
          const acc=base-0.14-0.18*(ner/100-1);
          if(Math.random()<acc) this._damageHero(dmg,g);
        }else{
          const a=pick.a;
          const aner=(a.attrs&&a.attrs.ner)||100;
          const acc=base-0.10*(aner/100-1);   // 队友/召唤物按神经反应有少量闪避
          if(Math.random()<acc) this._damageAlly(a,dmg,g);
        }
      }
    },

    /* 玩家承伤：血统特质（免疫/减伤/血族保命/感染）判定；倒下时先复活道具，再看是否还有队友 */
    _damageHero(dmg,g){
      const st=this.state,p=WK.P;
      const traits = WK.Blood ? WK.Blood.allTraits(p) : [];
      const has = k => traits.indexOf(k) >= 0;
      const elem = g.def.element || g.def.dmgType || "";
      const isMagic = elem === "magic" || !!g.def.magic;
      const isFire  = elem === "fire"  || !!g.def.fire;
      const isPoison= elem === "poison"|| !!g.def.poison;
      const isCold  = elem === "cold"  || !!g.def.cold;
      let guarded = false;
      if (isFire && has("fire_immune")) guarded = true;
      if (isPoison && (has("poison_immune") || has("plague_immune"))) guarded = true;
      if (isCold && has("cold_immune")) guarded = true;
      if (isMagic) {
        if (has("magic_immune")) guarded = true;
        else if (has("magic_resist")) dmg = Math.max(1, Math.round(dmg*0.5));
      }
      if (!guarded && !isMagic && has("phys_hardy")) dmg = Math.max(1, Math.round(dmg*0.72));
      if (guarded) {
        this._fxHero("免疫","l-good");
        this._log("l-good", g.def.name+(g.boss?"":"之一")+"的攻击被你的血统特质化解，毫发无伤。");
        return;
      }
      // 豆包v177：耐久护盾优先吸收（在血统免疫之后、血族保命/掉血之前）
      const ab = WK.Shield.absorb(dmg, g);
      if (ab.absorbed > 0) {
        this._fxHero("盾 -" + ab.absorbed, "l-good");
        this._log("l-good", g.def.name + (g.boss ? "" : "之一") + "的一击被护罩挡下 " + ab.absorbed + " 点" +
          (WK.Shield.total() > 0 ? "（护罩余 " + Math.round(WK.Shield.total()) + "）" : "（护罩碎裂！）"));
      }
      dmg = ab.dmg;
      this.render();
      if (dmg <= 0) return;   // 护罩完全吸收，不掉血、不触发感染
      // 血族之心：本场首次致命伤保留 1 点生命
      if (dmg >= p.hp && has("regen_vampire") && !st._deathSaveUsed) {
        p.hp = 1; st._deathSaveUsed = true;
        this._fxHero("濒死","l-crit");
        this._log("l-crit","致命一击洞穿身体——可你的心脏仍在跳动（血族之心：本场首次致命伤保留 1 点生命）。");
      } else {
        p.hp = Math.max(0, p.hp - dmg);
        this._fxHero("-"+dmg,"l-hit");
        this._log("l-hit", g.def.name+(g.boss?"":"之一")+"击中你 -"+dmg+"。");
      }
      if (g.def.infect && !p.flags.infected &&
          !(has("plague_immune")||has("poison_immune")||has("virus_adapt")) && Math.random()<0.18){
        p.flags.infected=true; st.infectedThis=true;
        this._log("l-crit","你被咬伤了——伤口传来一阵灼热（T 病毒感染，需尽快解毒/回主神清除）。");
      }
      this.render();
      if(p.hp<=0) this._heroDown(g);
    },

    /* 豆包v176：队友 / 召唤物承伤（无血统特质，直接吃伤害；阵亡后置灰、不再出手与承伤） */
    _damageAlly(a,dmg,g){
      const st=this.state;
      a.hp=Math.max(0,a.hp-dmg);
      a.lastAct="受创 -"+dmg;
      const tag=a.kind==="summon"?"【召唤】":"";
      this._fx(g,tag+a.name+" -"+dmg,"l-hit");
      if(a.hp<=0){
        a.lastAct="倒下";
        this._log("l-crit", tag+a.name+" 被"+g.def.name+(g.boss?"":"之一")+"击倒，倒下了！");
        this.render();
        // 玩家已倒下且再无站立的队友 → 全队覆灭
        if(st.heroDown && !this._liveAllies().length){ this._defeat(); }
      }else{
        this._log("l-hit", tag+a.name+" 挡下一击 -"+dmg+"。");
        this.render();
      }
    },

    /* 玩家倒下：先尝试复活道具；否则进入倒地状态——还有队友则战斗继续，无队友则败北 */
    _heroDown(g){
      const st=this.state;
      if(this._tryRevive()){ this.render(); return; }
      if(this._liveAllies().length){
        st.heroDown=true;
        this._fxHero("倒下","l-crit");
        this._log("l-crit","你眼前一黑倒了下去——好在队友仍在死战，他们若能清场，就能把你救回来！");
        this.render();
      }else{
        this._defeat();
      }
    },
    _allyAttack(a){
      const st=this.state;
      let g=st.groups[st.targetIdx]; if(!g||g.hp<=0) g=st.groups.find(x=>x.hp>0);
      if(!g) return;
      // 与玩家同一套 profile + rollAttack
      const actor=WK.combat.actorAlly(a);
      const prof=WK.combat.profile(actor);
      const r=WK.combat.rollAttack(prof, g.def, {});
      if(r.miss){
        a.lastAct="未命中"; this._fx(g,a.name+" 未中","l-info"); this._log("l-info", a.name+" 的攻击落空。"); return;
      }
      // 豆包v167：本集常驻队友都是普通枪械/拳脚（纯物理）；豆包v176：召唤物可由技能指定为魔法伤害（亡灵/元素→可伤灵体）
      const hr=this._hurt(g,r.dmg,{magic:!!a.magic});
      if(hr.blocked){ a.lastAct="无效"; this._fx(g,a.name+" 无效","l-info"); this._log("l-info", a.name+" 的攻击穿过灵体，毫无作用。"); return; }
      a.lastAct=(r.crit?"暴击 ":"")+"-"+hr.dealt;
      this._fx(g,a.name+(r.crit?" 暴击":"")+" -"+hr.dealt,"l-good");
      this._log("l-good", (a.line||r.text)+"，造成 "+hr.dealt+" 伤害。");
    },

    _allDead(){ return this.state.groups.every(g=>g.hp<=0); },

    /* 豆包v176：召唤——在【本次战斗】追加临时队友。有血有攻、会集气出手，敌人可随机攻击它；
       只存在于当前战斗（battle.start 每次重建 allies，战斗结束即清空）。spec:
       {key,name,count,hp,atk,hit,crit,cap,line,magic}  cap=同一召唤源同时存活上限（超出最早的一只消散）。 */
    summon(spec){
      const st=this.state; if(!st||st.ended||!spec) return false;
      const cnt=Math.max(1, spec.count||1);
      const key=spec.key||"sum";
      for(let k=0;k<cnt;k++){
        const base={
          id:"sum_"+key+"_"+Date.now()+"_"+k+"_"+Math.floor(Math.random()*1e4),
          name: (spec.name||"契约召唤兽")+(cnt>1?("·"+(k+1)):""),
          kind:"summon", summonKey:key,
          atk:spec.atk||14, hit:spec.hit||0, crit:spec.crit||0,
          hp:spec.hp||80, maxHp:spec.hp||80,
          attrs:null, equip:{}, bloodline:null, items:{}, skills:{},
          magic:!!spec.magic,
          charge:Math.random()*40,
          line:spec.line||((spec.name||"召唤兽")+"扑向敌人"),
          nextAt:0
        };
        const actor=WK.combat.actorAlly(base);
        const prof=WK.combat.profile(actor);
        base.attrs=actor.attrs; base.chargeMs=prof.chargeMs;
        // 同场上限：超出时最早的同源召唤物先消散（异界契约无法维持更多）
        if(spec.cap){
          const same=st.allies.filter(a=>a.kind==="summon"&&a.summonKey===key);
          if(same.length>=spec.cap){
          const old=same[0];
            st.allies=st.allies.filter(a=>a!==old);
            this._log("l-info","维持召唤的力量到了极限，最早的「"+old.name+"」化作光点消散。");
          }
        }
        st.allies.push(base);
      }
      this._log("l-good",(spec.flavor||("你缔结契约，召唤出 "+spec.name+(cnt>1?(" ×"+cnt):"")+" 助战！"))+"（仅本次战斗）");
      this.render();
      return true;
    },

    /* 豆包v176：可召唤援军的【道具】表（区别于血统召唤技）。charges=可使用次数，持久消耗于 p._sumCharges[id]。
       持有的判定同时看背包与已装备槽；召唤物同样只存在本次战斗、会被敌人攻击。 */
    SUMMON_ITEMS: {
      m_c1643734: { name:"骷髅战士", hp:95, atk:13, hit:0.05, crit:0.05, charges:5, magic:true, line:"法杖召出的骷髅战士扑向敌人" }
    },
    _ownsItem(id){
      const p=WK.P; if(!p) return false;
      if(WK.inv && WK.inv.count(id)>0) return true;
      const eq=p.equip||{};
      return Object.keys(eq).some(k=>eq[k]===id);
    },
    _sumChargesLeft(id){
      const p=WK.P; const def=this.SUMMON_ITEMS[id]; if(!def) return 0;
      if(!p._sumCharges) p._sumCharges={};
      if(p._sumCharges[id]==null) p._sumCharges[id]=def.charges;
      return p._sumCharges[id];
    },
    useSummonItem(id){
      const st=this.state,p=WK.P; if(!st||st.ended) return;
      if(st.heroDown){ this._log("l-hit","你已经倒下，无法行动。"); return; }
      const cfg=this.SUMMON_ITEMS[id]; if(!cfg) return;
      if(!this._ownsItem(id)){ this._log("l-info","你身上没有这件道具。"); return; }
      const left=this._sumChargesLeft(id);
      if(left<=0){ this._log("l-info","「"+(WK.ITEM_DEF[id]&&WK.ITEM_DEF[id].name||"召唤道具")+"」的召唤次数已用尽。"); return; }
      const ok=this.summon({ key:"it_"+id.slice(-6), name:cfg.name, count:1, hp:cfg.hp, atk:cfg.atk, hit:cfg.hit, crit:cfg.crit,
        cap:null, magic:cfg.magic, line:cfg.line, flavor:"你催动道具，召唤出 "+cfg.name+" 助战！" });
      if(ok){ p._sumCharges[id]=left-1; if(WK.save)WK.save.write(); this.render(); }
    },

    _win(){
      const st=this.state; if(st.ended) return; st.ended=true; clearInterval(this.timer);
      if (WK.GeneLock) WK.GeneLock.onBattleWin();
      const p=WK.P;
      if(st.zk>0 && WK.rules.settleZombieBattle) WK.rules.settleZombieBattle(st.zk);
      if(st.dk>0 && WK.rules.settleDogBattle) WK.rules.settleDogBattle(st.dk);
      for(let i=0;i<st.ck;i++) if(WK.rules.kill) WK.rules.kill("crawler");
      if(st.room && WK.Spawner) WK.Spawner.markCleared(st.room);
      const savedByTeammate = !!st.heroDown;
      st.heroDown=false;
      p.hp=Math.max(p.hp,1); WK.save.write();
      const ptsNow=p.points;
      const body='<div style="line-height:2;color:#c8d6c8;">'+
        (savedByTeammate?'<b style="color:var(--gold)">队友在你倒下后死战清场，把你从鬼门关前拽了回来（恢复 1 点生命）。</b><br>':'')+
        '清场成功。'+
        (st.zk?'<br>击杀丧尸 <b style="color:#e0a0a0">'+st.zk+'</b> 只（成群计点）。':'')+
        (st.dk?'<br>击杀丧尸犬 <b style="color:#d8a06a">'+st.dk+'</b> 只（极速犬群，成群计点）。':'')+
        (st.ck?'<br>击杀爬行者 <b style="color:var(--gold)">'+st.ck+'</b> 只。':'')+
        (st.infectedThis?'<br><span style="color:var(--gold)">你已被 T 病毒感染，务必尽快处理。</span>':'')+
        '<br>当前奖励点：<b style="color:var(--gold)">'+ptsNow+'</b></div>'+
        '<button class="here-btn primary" style="width:100%;margin-top:14px;padding:11px;" onclick="WK.battle.confirmEnd()">继续</button>';
      this._close();
      this._pending=function(){ if(st.opts.onWin)st.opts.onWin(); };
      WK.ui.generic("战斗胜利", body);
    },
    /* 通用 generic 只接 (title,html)，结局回调经此在玩家点确认后执行 */
    confirmEnd(){ const fn=this._pending; this._pending=null;
      WK.ui.closeOverlay("ov-generic"); if(fn)fn(); },
    /* 豆包v172：死亡瞬间自动消耗复活道具（重生十字章/复活币/重生药水）原地复生、战斗继续。
       A 线最终战属剧本「回归」，不消耗复活手段（那是必经回归，不是失败）。*/
    _tryRevive(){
      const st=this.state, p=WK.P;
      const mode=st.opts.defeatMode || (WK.FREE_ROAM?"test":"erase");
      if(mode==="return") return false;
      const items=p.items||{};
      let rid=null;
      Object.keys(items).some(id=>{ if(items[id]>0 && WK.ITEM_DEF[id] && WK.ITEM_DEF[id].revive){ rid=id; return true; } return false; });
      if(!rid) return false;
      const d=WK.ITEM_DEF[rid], pct=(d.revive&&d.revive.hpPct)||0.4;
      if(!d.infinite) WK.inv.remove(rid,1);
      p.hp=Math.max(1,Math.min(p.maxHp,Math.round(p.maxHp*pct)));
      WK.save.write();
      this._log("l-good","你已眼前发黑——「"+(d.name||"复活道具")+"」骤然碎裂，一股沛然之力把你从死亡线上硬生生拽了回来！生命恢复 "+Math.round(p.hp)+"。");
      this._fxHero("复活 +"+Math.round(p.hp),"l-good");
      this.render();
      return true;
    },
    _defeat(){
      const st=this.state; if(st.ended) return;
      if (this._tryRevive()) return;   // 豆包v172：有复活道具则原地复生，战斗继续
      st.ended=true; clearInterval(this.timer);
      if (WK.GeneLock) WK.GeneLock.onBattleDefeat();
      const mode=st.opts.defeatMode || (WK.FREE_ROAM?"test":"erase");
      this._close();
      if(mode==="return"){
        this._pending=function(){ if(st.opts.onDefeat)st.opts.onDefeat(); };
        WK.ui.generic("千钧一发",
          '<div style="line-height:2;color:#c8d6c8;">爬行者的利爪已经逼到面门，腥臭的风扑面，退无可退——<br>就在这<span style="color:var(--gold)">千钧一发之际，主神手表上的倒计时，归零了</span>。<br>「叮」的一声轻响，一道光柱自头顶轰然落下，将你从爪牙前硬生生卷起、拽离了这片蜂房。</div>'+
          '<button class="here-btn primary" style="width:100%;margin-top:14px;padding:11px;" onclick="WK.battle.confirmEnd()">确认</button>');
      } else if(mode==="erase"){
        if(WK.rules.erase) WK.rules.erase("在战斗中被击杀");
      } else {
        WK.P.hp=1;
        this._pending=function(){ WK.save.write(); };
        WK.ui.generic("你倒下了",
          '<div style="line-height:2;color:#c8d6c8;">（漫游测试：已把你拉回 1 点生命。<br>正式模式中，非特殊战斗倒下即被抹杀；A 线最终战倒下则回归主神。）</div>'+
          '<button class="here-btn primary" style="width:100%;margin-top:14px;padding:11px;" onclick="WK.battle.confirmEnd()">爬起来</button>');
      }
    },
    tryFlee(){
      const st=this.state; if(!st||st.ended) return;
      if(st.opts.noFlee || st.groups.some(g=>g.boss&&g.hp>0)){ this._log("l-crit","爬行者堵死了退路，逃不掉！"); return; }
      if(Math.random()<0.7){ st.ended=true; clearInterval(this.timer); this._log("l-info","你脱离了接触。");
        this._close(); WK.save.write();
      } else this._log("l-hit","撤离失败，被缠住了！");
    },
    toggleSpeed(){ const st=this.state; if(!st) return; st.speed=st.speed===1?2:1; this._el("bt-speed").textContent=st.speed+"×"; },
    setTarget(i){ const g=this.state.groups[i]; if(g&&g.hp>0) this.state.targetIdx=i; this.render(); },

    /* —— 渲染 —— */
    render(){
      const st=this.state,p=WK.P; if(!st) return;
      const stage=this._el("bt-stage");
      stage.innerHTML=st.groups.map((g,i)=>{
        const pct=Math.max(0,g.hp/g.maxHp*100);
        const sel=i===st.targetIdx&&g.hp>0?' style="outline:2px solid var(--gold);outline-offset:-2px;"':'';
        const nameTxt=g.def.name+(g.alive>1?(" ×"+g.alive):"");
        let sub;
        if(g.def.foeType==="ghost") sub="灵体 · 物理免疫 · 仅吃附魔/神圣/符咒";   // 豆包v167：鬼怪属性提示
        else sub=g.boss?"猎杀者 · 高威胁 · 有护甲":(g.def.speed+" · "+(g.def.infect?"可感染":""));
        return '<div class="bt-en'+(g.boss?' boss':'')+'"'+sel+' onclick="WK.battle.setTarget('+i+')">'+
          '<div class="bt-en-row"><div class="bt-en-ava">'+g.def.ava+'</div><div class="bt-en-meta">'+
          '<div class="bt-en-name">'+nameTxt+'</div><div class="bt-en-sub">'+sub+'</div>'+
          '<div class="bt-en-bar"><div class="bt-en-fill" style="width:'+pct+'%"></div>'+
          '<span class="bt-en-hp">'+Math.max(0,Math.ceil(g.hp))+'/'+g.maxHp+'</span></div></div></div></div>';
      }).join("");
      this._el("bt-hp-fill").style.width=Math.max(0,p.hp/p.maxHp*100)+"%";
      this._el("bt-hp-txt").textContent="生命 "+Math.ceil(p.hp)+"/"+p.maxHp+(p.flags&&p.flags.infected?" · 感染":"");
      // 豆包v177：耐久护盾条（仅展示当前生效且未耗尽的层）
      const shWrap=this._el("bt-shield-wrap");
      if(shWrap && WK.Shield){
        const shL=WK.Shield.layers().filter(l=>l.cur>0 && WK.Shield._active(l));
        if(shL.length){
          const cur=shL.reduce((s,l)=>s+l.cur,0), mx=Math.max(1,shL.reduce((s,l)=>s+l.max,0));
          shWrap.style.display="";
          this._el("bt-shield-fill").style.width=Math.max(0,Math.min(100,cur/mx*100))+"%";
          this._el("bt-shield-txt").textContent="护盾 "+Math.round(cur)+(shL.length>1?(" · "+shL.map(l=>l.name).join("/")):"");
        } else shWrap.style.display="none";
      }
      // 豆包v173：特殊能量（内力/法力/血统能量…）渲染为独立彩条；体力条只显示体力本身
      if (WK.Blood) WK.Blood.syncRes(p);
      const poolBox = this._el("bt-pools");
      if (poolBox) {
        const ORDER = [
          ["neili","内力","#5fc0d6"],["mana","法力","#8a8fe0"],["blood","血能","#d86a6a"],
          ["rage","狂化","#e0a050"],["virus","病毒","#c8d060"],["spirit","精神","#6aa8e0"],
          ["nature","自然","#7fd08a"],["erosion","蚀力","#a06ac0"],["ling","灵力","#e0d090"],["energy","能量","#7fd8d0"]
        ];
        const src = WK.Blood ? WK.Blood.energySources(p) : {};
        let ph = "";
        ORDER.forEach(function(pr){
          const e = src[pr[0]]; if (!e || !(e.max > 0)) return;
          const pct = Math.max(0, e.cur / e.max * 100);
          ph += '<div class="bt-bar" style="height:11px;margin:0;"><div class="bt-bar-fill" style="width:'+pct+'%;background:'+pr[2]+';opacity:.95;"></div>'+
                '<span style="font-size:9.5px;">'+pr[1]+' '+Math.round(e.cur)+'/'+Math.round(e.max)+'</span></div>';
        });
        poolBox.innerHTML = ph;
        poolBox.style.display = ph ? "flex" : "none";
      }
      const cap=(p.res&&p.res.maxStamina)||60, sta=Math.round(p.res?p.res.stamina||0:0);
      this._el("bt-sta-fill").style.width=Math.max(0,sta/cap*100)+"%";
      this._el("bt-sta-txt").textContent="体力 "+sta+"/"+cap;
      this._el("bt-charge").style.width=st.charge+"%";
      let chargeTxt = st.charge>=95?"自动开火":("集气 "+Math.floor(st.charge)+"%");
      if (WK.GeneLock) {
        const gs = WK.GeneLock.statusText();
        if (gs && WK.GeneLock.isActive()) chargeTxt = "🧬 " + gs;
        else if (gs && gs.indexOf("惩罚")>=0) chargeTxt = chargeTxt + " · " + gs.split(" · ").filter(function(x){return x.indexOf("惩罚")>=0||x.indexOf("反噬")>=0;}).join(" · ");
      }
      this._el("bt-charge-txt").textContent=chargeTxt;
      // 豆包v143：队友状态条（血量 + 下次出手 + 最近行动）
      const allyBox=this._el("bt-allies");
      if(allyBox){
        if(!st.allies.length){ allyBox.style.display="none"; allyBox.innerHTML=""; }
        else {
          allyBox.style.display="block";
          const nowA=Date.now();
          allyBox.innerHTML='<div style="font-size:11px;color:var(--dim);margin-bottom:5px;letter-spacing:1px;">队友 · 召唤物</div>'+
            st.allies.map(a=>{
              const pct=Math.max(0,(a.hp/(a.maxHp||90))*100);
              const ch=Math.max(0, Math.min(100, a.charge||0));
              const isSum=a.kind==="summon";
              const dead=a.hp<=0;
              const iconBg=isSum?"#3a2a55":"#2a2410";
              const iconCol=isSum?"#c8b0f0":"var(--gold)";
              const nameCol=isSum?"#c8b0f0":"var(--gold)";
              return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;background:var(--panel2);border:1px solid '+(isSum?"#5a4a8055":"var(--line)")+';border-radius:5px;padding:3px 7px;'+(dead?"opacity:.45;":"")+'">'+
                '<div style="position:relative;width:28px;height:28px;border-radius:6px;background:'+iconBg+';color:'+iconCol+';display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;flex-shrink:0;">'+(a.name?a.name[0]:"友")+(isSum?'<span style="position:absolute;top:-4px;right:-5px;font-size:8px;background:#6a4aa0;color:#fff;border-radius:4px;padding:0 2px;line-height:11px;">召</span>':"")+'</div>'+
                '<div style="flex:1;min-width:0;">'+
                  '<div style="display:flex;justify-content:space-between;font-size:12px;"><span style="color:'+nameCol+';font-weight:600;">'+a.name+(dead?' <span style="color:#c0786a;font-size:10px;">倒下</span>':'')+'</span>'+
                  '<span style="color:var(--cyan);font-size:10px;">'+(dead?"—":(ch>=95?"即将出手":("集气 "+Math.floor(ch)+"%")))+'</span></div>'+
                  '<div style="height:6px;background:#000;border:1px solid #3a5a3a;border-radius:3px;margin-top:3px;overflow:hidden;"><div style="height:100%;width:'+pct+'%;background:linear-gradient(90deg,#3a8f4a,#6fbf6f);"></div></div>'+
                  '<div style="height:5px;background:#000;border:1px solid #5a5028;border-radius:3px;margin-top:3px;overflow:hidden;"><div style="height:100%;width:'+ch+'%;background:linear-gradient(90deg,#9a7a20,#ffd966);"></div></div>'+
                  '<div style="font-size:10px;color:var(--dim2);margin-top:2px;">HP '+Math.ceil(a.hp)+'/'+(a.maxHp||90)+(a.lastAct?(" · "+a.lastAct):"")+'</div>'+
                '</div></div>';
            }).join("");
        }
      }
      // 技能按钮（自动普攻不占按钮位）
      const now=Date.now();
      (function(){
        // v158：底部只留技能；普攻由集气满自动出手（有武器用武器，否则挥拳）
        let html = "";
        const skills = WK.battleSkills().filter(function (id) {
          const d = WK.SKILL_DEF[id];
          return d && d.kind !== "passive" && !d.auto;
        });
        if (!skills.length) {
          html = '<div style="grid-column:1/-1;font-size:12px;color:var(--dim);line-height:1.6;padding:6px 2px;">集气满后自动攻击：有装备武器则用武器，否则挥拳。兑换技能后显示在此。</div>';
        } else {
          skills.forEach(function (id) {
            const d = WK.SKILL_DEF[id];
            const meta = (WK.SKILL_META && WK.SKILL_META[d.type]) || { label: "技" };
            const need = d.charge || 0;
            const resEnough = !d.res || ((p.res[d.res] || 0) >= d.cost);
            const cdLeft = st.cds[id] && now < st.cds[id] ? Math.ceil((st.cds[id] - now) / 1000) : 0;
            const dis = st.charge < need || !resEnough || cdLeft > 0;
            html += '<button class="bt-skill" ' + (dis ? "disabled" : "") + ' onclick="WK.battle.use(\'' + id + '\')">' +
              '<span class="sk-type t-' + d.type + '">' + meta.label + '</span>' +
              '<div class="sk-n">' + d.name + '</div>' +
              '<div class="sk-c">集气' + need + '</div>' +
              (cdLeft > 0 ? '<div class="sk-cd">' + cdLeft + '</div>' : '') + '</button>';
          });
        }
        this._el("bt-skills").innerHTML = html;
      }).call(this);
      // 豆包v167：附魔一击栏（装备枪/弓后出现特殊魔法弹；遇鬼怪且无手段时给对策提示）
      (function(){
        const box=this._el("bt-shots"); if(!box) return;
        const shots=WK.combat.enchShots();
        const hasGhost=st.groups.some(function(g){ return g.hp>0 && g.def && g.def.foeType==="ghost"; });
        let h="";
        if(hasGhost && !shots.length){
          h='<div class="bt-shot-hint">目标是 <b style="color:#e0a0a0">灵体</b>，普通攻击无效——装备枪械后使用 <b>附魔 / 灵类 / 神圣弹</b>，或用 <b>神圣手雷、驱邪符咒</b>；若<b>徒手戴纳戒且体内有能量</b>，拳头裹能量也可伤灵体。</div>';
        }
        h+=shots.map(function(s){
          const role=(s.tag==="spirit"||s.tag==="holy")?"克灵":"魔伤";
          return '<button class="bt-shot" onclick="WK.battle.fireShot(\''+s.id+'\')">'+
            '<span class="bs-n"><span class="bs-tag">'+s.tone+'</span>'+s.name+'</span>'+
            '<span class="bs-c">×'+s.count+' · '+role+'</span></button>';
        }).join("");
        box.innerHTML=h;
      }).call(this);
      // 豆包v135/v139 N20：战斗道具栏（数据驱动）：投掷物 + 回血/回体；数量为 0 或对应资源已满则禁用
      this._el("bt-items").innerHTML = (function(){
        const list = WK.battle.listBattleItems();
        let h = list.filter(function(cfg){ return WK.inv.count(cfg.id) > 0; }).map(function(cfg){
          const n = WK.inv.count(cfg.id);
          let full = false;
          if (cfg.res === "hp") full = p.hp >= p.maxHp - 0.5;
          else if (cfg.res === "sta" && p.res) full = p.res.stamina >= (p.res.maxStamina || 60) - 0.5;
          const dis = full;
          const right = "×" + n + (cfg.hint ? (" · " + cfg.hint) : "");
          return '<button class="bt-item ' + (cfg.kind === "heal" ? "bi-heal" : "") + '" ' + (dis ? "disabled" : "") +
            ' onclick="WK.battle.useItem(\'' + cfg.id + '\')">' +
            '<span class="bi-n">' + cfg.label + '</span><span class="bi-c">' + right + '</span></button>';
        }).join("");
        // 豆包v176：可召唤援军的道具（如召唤骷髅法杖，限次）
        Object.keys(WK.battle.SUMMON_ITEMS || {}).forEach(function(sid){
          if (!WK.battle._ownsItem(sid)) return;
          const left = WK.battle._sumChargesLeft(sid);
          if (left <= 0) return;
          const sd = WK.ITEM_DEF[sid] || {};
          const scfg = WK.battle.SUMMON_ITEMS[sid];
          h += '<button class="bt-item" style="border-color:#7a5ca8;" ' + (st.heroDown ? "disabled" : "") +
            ' onclick="WK.battle.useSummonItem(\'' + sid + '\')">' +
            '<span class="bi-n">召唤·' + scfg.name + '</span><span class="bi-c">' + (sd.name ? (sd.name + " · ") : "") + '剩' + left + '次</span></button>';
        });
        if (!h) {
          return '<div style="font-size:11.5px;color:var(--dim);padding:4px 2px;">无战斗道具。在背包将绷带/喷雾等设为「战斗中使用」。</div>';
        }
        return h;
      })();
    },
    _fx(g,txt,cls){ const el=this._el("bt-stage").children[this.state.groups.indexOf(g)]; if(!el)return;
      const s=document.createElement("div"); s.className="bt-fx "+(cls||"l-hit"); s.textContent=txt;
      s.style.left=(40+Math.random()*40)+"%"; s.style.top=(20+Math.random()*30)+"%"; el.appendChild(s);
      setTimeout(()=>s.remove(),800); },
    _fxHero(txt,cls){ const el=this._el("bt-hero"); const s=document.createElement("div");
      s.className="bt-fx "+(cls||"l-hit"); s.textContent=txt; s.style.right="24px"; s.style.top="8px"; el.appendChild(s);
      setTimeout(()=>s.remove(),800); },
    _log(cls,txt){ const box=this._el("bt-log"); const d=document.createElement("div"); if(cls)d.className=cls;
      d.textContent=txt; box.appendChild(d); box.scrollTop=box.scrollHeight; },
    _el(id){ return document.getElementById(id); },
    _close(){ if(this.timer){clearInterval(this.timer);this.timer=null;} WK.ui.closeOverlay("ov-battle"); if(this.state)this.state.active=false; },

    /* —— N6 漫游测试入口：当前房若门控已开且摇得到怪，场景区显示「遭遇」按钮（N14 移除/转自动）——
       正式模式(FREE_ROAM=false)下进房自动开战由 N10 剧情管道接管。 */
    renderEncounter(room){
      const el=document.getElementById("encounter-container"); if(!el)return;
      if(!WK.FREE_ROAM){ el.innerHTML=""; return; }
      const roomId=WK.P.location;
      const rule=WK.Spawner.ruleFor(roomId);
      if(!rule||!WK.Spawner.gateOpen(rule,WK.P.flags)||WK.Spawner.inCooldown(roomId)){ el.innerHTML=""; return; }
      const wave=WK.Spawner.roll(roomId,WK.P.flags).wave;
      if(!wave||!wave.length){ el.innerHTML=""; return; }
      const sum={}; wave.forEach(w=>sum[w.id]=(sum[w.id]||0)+w.count);
      const txt=Object.keys(sum).map(id=>WK.ENEMIES[id].name+"×"+sum[id]).join("、");
      el.innerHTML='<button class="enc-btn" onclick="WK.battle.start(\''+roomId+'\')">⚠ 遭遇：'+txt+
        '<span class="enc-sub">测试入口 · 点击开战（清场计点；正式模式由剧情触发）</span></button>';
    }
  };


  /* ============================================================
   * 豆包N7：队友系统（入队 / 离队 / 跟随移动 / 战斗协攻 / 辅助光环）
   * ------------------------------------------------------------
   * 入队的人：id 记入 P.party，其 P.npcs[id].loc 永远跟随玩家所在房间；
   * 战斗开始时由 WK.battle 自动编入协攻（读 NPCS[id].ally 模板）。
   * 正式剧情（N10-12）通过 WK.party.join(id,'剧情原因') 在指定节点拉入；
   * N7 漫游测试期可在 NPC 档案里手动邀请。离队分两种：
   *   leave(id)  暂时离队（人留在当前房，仍 alive，可再邀请/剧情归队）
   *   kill(id)   剧情死亡（N8/N12 调；离队 + alive=false，不可再邀）
   * 本集队友战斗不承伤、不倒地（新人期，且郑吒/詹岚剧情存活），模板里的
   * hp 预留给后续卷「队友可被击倒/保护主角」扩展；复杂 AI 以后可单独扩写。
   * ============================================================ */
  WK.party = {
    list(){
      const p=WK.P;
      return (p.party||[]).map(id=>{
        if(WK.NPCS[id]) return { id:id, def:WK.NPCS[id], st:WK.npcState(id), created:false };
        // 豆包v142：主神造人没有 NPCS/npcState 档，合成一个同构对象，保证协攻/在队判定通用
        if(WK.CREATED){ const c=WK.CREATED.get(id); if(c) return { id:id, def:this._createdDef(c), st:{ alive:true, loc:p.location }, created:true }; }
        return null;
      }).filter(x=>x && x.def && x.st && x.st.alive!==false);
    },
    /* 造人记录 → 与 NPCS 同构的 def（ally 战档由六维派生；永久同行、引导者藏拙规则不适用）*/
    _createdDef(c){
      const ally=WK.CREATED.allyOf(c);
      return { name:c.name, ava:"人", camp:"created", title:"主神造人 · 同伴",
        realName:null, recruitable:false, ally:ally, created:true, gender:c.gender };
    },
    ids(){ return this.list().map(x=>x.id); },
    has(id){ return this.ids().indexOf(id)>=0; },
    count(){ return this.ids().length; },

    /* 豆包v119：入队的「剧情门控」。开局到下楼大家自顾逃命、互不信任，不能拉人入队；
       要等注水研究区自我介绍、众人确认「相依为命」后（flags.allyUnlocked）才解锁。
       正式剧情的强制拉入（opts.force）不受此限。要改解锁节点，只需在对应剧情事件里置位该旗标。 */
    recruitUnlocked(){ return !!(WK.P && WK.P.flags && WK.P.flags.allyUnlocked); },
    /* 豆包v125：本集入队收口。
       一部恐怖片里真正能拉进队伍的，只有标记了 recruitable 的角色（本集＝郑吒、詹岚），
       且要满足：有 ally 战斗档案、本人活着、过了自我介绍总闸、好感度达到 def.favorRequired。
       其余轮回者（牟钢/李萧毅/小胖/妇女）本集各有命运或只是累赘，再熟也不与你组队；
       引导者张杰绝不站队。剧情强制拉入走 join(...,{force:true})，不受此限。 */
    favorOf(id){ return (WK.P && WK.P.favor && WK.P.favor[id]) || 0; },
    canRecruit(id){
      const def=WK.NPCS[id], st=WK.npcState(id);
      if(!def || !def.ally || !st || st.alive===false) return false;
      if(!def.recruitable) return false;              // 本集只有郑吒/詹岚可邀
      if(!this.recruitUnlocked()) return false;       // 自我介绍、确认相依为命后才谈组队
      if(this.favorOf(id) < (def.favorRequired||0)) return false;  // 好感不够，对方还不肯交心
      return true;
    },

    /* 入队。reason 用于日志；favor 为正式剧情邀请门槛（默认漫游 0 即可）。
       opts.force=true 时跳过门槛/存活地检查（剧情强制拉入用）。返回是否成功。 */
    join(id, reason, opts){
      opts=opts||{};
      const def=WK.NPCS[id], st=WK.npcState(id), p=WK.P;
      if(!def||!def.ally){ WK.toast("这个人不能加入战斗队伍","bad"); return false; }
      if(!st){ WK.toast("对方状态异常","bad"); return false; }
      if(!st.alive && !opts.force){ WK.toast(def.name+" 已经无法同行","bad"); return false; }
      if(this.has(id)) return true;
      // 豆包v119/v122：剧情未到不能自行邀请（force 剧情拉入可绕过）。这阶段人人自危、优先怀疑你，通用兜底回怀疑句；
      // 正常点【邀请同行】会先走 WK.tryInvite 给每人定制的「怀疑/自保」台词，这里只防直接调 join。
      if(!opts.force && !this.recruitUnlocked()){
        WK.toast("「别套近乎……这种时候，我只信我自己。」","gold");
        WK.log("sys", "（对方警惕地看着你——人人都在自保，没人敢把后背交给一个刚认识的人。）");
        return false;
      }
      const need=opts.favorRequired!==undefined?opts.favorRequired:(def.favorRequired||0);
      if(!opts.force && (p.favor[id]||0)<need){
        WK.toast(def.name+" 对你还不够信任（好感 "+(p.favor[id]||0)+"/"+need+"）","bad"); return false;
      }
      p.party=p.party||[]; p.party.push(id);
      st.loc=p.location; st.met=true;
      WK.save.write();
      const nm=WK.npcDisplayName(id);
      WK.log("team", (reason||("")) + (reason?"":"") + nm+" 加入了你的队伍。");
      WK.toast(nm+" · 入队","gold");
      if(typeof WK.renderScene==="function") WK.renderScene();
      return true;
    },
    /* 暂时离队：留在 roomId（默认当前房）*/
    leave(id, reason, roomId){
      const p=WK.P; if(!this.has(id)) return;
      p.party=p.party.filter(x=>x!==id);
      const st=WK.npcState(id); if(st) st.loc=roomId||p.location;
      WK.save.write();
      WK.log("team", (reason||"") + (WK.NPCS[id]?WK.NPCS[id].name:id) + (reason?"":"暂时离开了队伍。"));
      if(typeof WK.renderScene==="function") WK.renderScene();
    },
    /* 剧情死亡：离队并标记死亡 */
    kill(id, reason){
      const p=WK.P, def=WK.NPCS[id];
      if(this.has(id)) p.party=p.party.filter(x=>x!==id);
      const st=WK.npcState(id); if(st) st.alive=false;
      WK.save.write();
      WK.log("danger", (reason||((def?def.name:id)+" 死亡。")));
    },
    /* 玩家移动到 roomId 后调用：所有在队存活者 loc 同步过去 */
    follow(roomId){
      this.ids().forEach(id=>{ const st=WK.npcState(id); if(st) st.loc=roomId; });
    },

    /* 战斗协攻编组（喂给 WK.battle.start 的 allies）。
       豆包v122：入队协攻一律走 combatStats(id,false)=「表面属性」——所以引导者张杰在队里也只表现为普通人，
       他在藏拙；只有未来与玩家为敌（asEnemy=true）时才取 allyReal 的爆表数值。 */
    battleAllies(){
      return this.list().map(x=>{ const a=this.combatStats(x.id,false)||x.def.ally||{};
        return { id:x.id, name:WK.npcDisplayName(x.id), atk:a.atk||14, hit:a.hit||0, crit:a.crit||0,
          hp:a.hp||90, maxHp:a.hp||90, line:a.line||(WK.npcDisplayName(x.id)+"开火") }; });
    },

    /* 取某轮回者的战斗档案：asEnemy=true 且对方是引导者(team:"guide")时用 allyReal 真实战力，
       其余情况（含引导者入队协攻）都用表面 ally。未来敌对轮回者/反目剧情统一走这里取数值。 */
    combatStats(id, asEnemy){
      const def=WK.NPCS[id]; if(!def || !def.ally) return null;
      return (asEnemy && def.team==="guide" && def.allyReal) ? def.allyReal : def.ally;
    },
    /* 詹岚类观察辅助光环汇总：玩家命中加成、集气速度加成 */
    aura(){
      let hit=0, charge=0;
      this.list().forEach(x=>{ const a=x.def.ally.aura; if(a){ hit+=(a.hit||0); charge+=(a.charge||0); } });
      return { hit:hit, charge:charge };
    }
  };

  /* 豆包v122：NPC 对外显示名。
     小胖子/中年妇女本是旁人随口的称呼；被你在楼梯救下（savedXxx）只是让他们活下来，
     要等注水研究区自我介绍、亲口报上真名（revealNameXxx）之后，队伍/面板/战斗里才以
     「庞大海 / 李秀兰」示人——没救（人已死）或还没走到自我介绍，都维持原称呼。 */
  WK.npcDisplayName = function(id){
    if (WK.CREATED && WK.CREATED.get(id)) return WK.CREATED.get(id).name;  // 豆包v142：主神造人直呼其名
    const def=WK.NPCS[id]; if(!def) return id;
    if(def.realName && WK.P && WK.P.flags){
      const key="revealName"+id.charAt(0).toUpperCase()+id.slice(1);
      if(WK.P.flags[key]) return def.realName;
    }
    return def.name;
  };


  /* ============================================================
   * 豆包v123：可复用「NPC 苦战 / 营救」机制
   * ------------------------------------------------------------
   * 用途：某 NPC 在某个地块被怪物缠住、命悬一线，玩家可当场【帮助】（打一架把人救回），
   *   或【离开】（走到相邻格 → NPC 死亡，事后回头能看到尸体）。
   *   以后任何一部恐怖片要做同类桥段，只需：①在 WK.RESCUES 加一条配置；
   *   ②让该地块的进场过场在 onDone 里 WK.rescue.start(key)；③补「救下」「尸体」两段文案即可。
   *
   * 状态（都进存档 P.flags）：
   *   _rescueActive   正在发生、尚未结算的救援 key（人还挂在那一格苦战）
   *   <def.flag>      "saved" 已救下 / "dead" 离开致死
   * 规则（lon 拍板）：点【帮助】→ 战胜则 NPC 存活并给改变命运的奖励；点【离开】不立刻死，
   *   玩家只要还在同一格就能反悔回头再帮；一旦 goDir 走到相邻格，NPC 当场死亡。
   * ============================================================ */
  WK.RESCUES = {
    jd_sw:{
      npc:"jd", room:"sw_walkway", flag:"rescueJd",
      reward:10,
      title:"J.D. 苦战中",
      intro:"断后的 J.D. 被几只从侧管扑出的丧尸拽到维修通道护栏外，大半个身子悬在黑水上空。他一只手死死抠住锈蚀栏杆，另一只手里的枪还在零星开火，指节已经发白。",
      cry:"「别愣着——！搭把手！！」",
      wave:[ {id:"zombie",count:7}, {id:"zombie_sci",count:2} ],
      allies:[
        { id:"matthew", name:"马修", atk:20, hit:0.18, crit:0.10, line:"马修点射压住阵脚" },
        { id:"alice", name:"艾丽丝", atk:28, hit:0.22, crit:0.18, line:"艾丽丝借护栏一晃精准点射" }
      ]
    }
  };

  WK.rescue = {
    activeId(){ const f=WK.P&&WK.P.flags; return (f&&f._rescueActive)||null; },
    activeDef(){ const k=this.activeId(); return k?WK.RESCUES[k]:null; },
    /* 人物列表据此把该 NPC 渲染成红色「苦战中」、点击打开营救面板（而非普通档案）*/
    isStruggling(id){ const c=this.activeDef(); return !!(c && c.npc===id); },

    /* 进场过场结束时调用：NPC 进入苦战态、停在原地，弹出营救面板 */
    start(key){
      const p=WK.P,c=WK.RESCUES[key]; if(!p||!c)return;
      if(p.flags[c.flag]) return;                    // 已救下/已死，不重复触发
      p.flags._rescueActive=key;
      const st=WK.npcState(c.npc); if(st){ st.struggle=true; st.loc=c.room; }
      WK.save.write(); WK.renderScene();
      setTimeout(()=>{ if(this.activeId()===key) this.panel(key); }, 120);
    },

    panel(key){
      const c=WK.RESCUES[key]; if(!c)return;
      const def=WK.NPCS[c.npc];
      const nm=def?WK.npcDisplayName(c.npc):c.npc;
      const h=
        '<div style="display:flex;gap:11px;align-items:center;margin-bottom:10px;">'+
          '<div class="p-ava" style="width:44px;height:44px;font-size:20px;background:#7d3a36;">'+(def?def.ava:"?")+'</div>'+
          '<div style="font-size:16px;font-weight:bold;color:var(--txt);">'+nm+
          ' <span class="struggle-tag">苦战中</span></div></div>'+
        '<div style="font-size:13px;color:var(--dim2);line-height:1.8;margin:2px 0 8px;">'+c.intro+'</div>'+
        '<div style="font-size:13px;color:#e0a0a0;line-height:1.7;margin:0 0 12px;">'+(c.cry||"")+'</div>'+
        '<div style="font-size:12px;color:var(--dim);line-height:1.7;margin:0 0 12px;">扑到近前开枪，就得和这群丧尸正面交火；转身随大部队先走，他撑不过你离开这一格——但只要你还站在这儿，回头仍来得及。</div>'+
        '<div style="display:flex;gap:9px;">'+
          '<button class="here-btn primary" style="flex:1" onclick="WK.rescue.help(\''+key+'\')">帮助（开枪救他）</button>'+
          '<button class="here-btn" style="flex:1" onclick="WK.rescue.abandon(\''+key+'\')">离开（随队先走）</button>'+
        '</div>';
      WK.ui.generic(c.title, h);
    },

    /* 帮助：打这波怪。战胜→救活；战斗中撤离不算完，人还挂着，退回原地可再点 */
    help(key){
      const c=WK.RESCUES[key]; if(!c)return;
      const def=WK.NPCS[c.npc];
      WK.ui.closeOverlay("ov-generic");
      WK.battle.start(c.room,{
        title:"营救 · "+(def?def.name:c.npc),
        wave:c.wave, allies:c.allies,
        onWin:()=>this.resolveSave(key)
      });
    },

    /* 离开：只关面板、留一句。人仍在苦战，玩家没走出这一格前随时能反悔 */
    abandon(key){
      const c=WK.RESCUES[key]; if(!c)return;
      WK.ui.closeOverlay("ov-generic");
      WK.toast("你转身跟上大部队，把他的嘶吼留在了身后","bad");
      WK.log("sys","你没有回头。再往前一步，身后那条命大概就没了——可只要还站在这格，你仍来得及转身。");
    },

    /* goDir 成功移动到相邻格前调用：若该格的苦战还没结算，NPC 当场死亡 */
    handleLeave(fromRoom){
      const c=this.activeDef(); if(!c||c.room!==fromRoom)return;
      this.resolveDeath();
    },

    /* 共同收尾：半空通道一段了结 → 推进 stage10、幸存者转进旧站台（J.D. 是否在队看 rescueJd）*/
    _advanceStation(){
      const p=WK.P;
      if(!p.flags._bWalkwayResolved){
        p.flags._bWalkwayResolved=true;
        WK.story.goToStage(10,{silent:true});   // 内部 applyStage 后，再用下面 fn 把幸存者摆到旧站台
      }
      if(WK.EVT.fnLib.n12BSquadStation) WK.EVT.fnLib.n12BSquadStation();
    },

    resolveSave(key){
      const p=WK.P,c=WK.RESCUES[key]; if(!p||!c)return;
      p.flags[c.flag]="saved"; delete p.flags._rescueActive;
      const st=WK.npcState(c.npc); if(st) st.struggle=false;
      if(c.reward) p.points=(p.points||0)+c.reward;
      this._advanceStation();
      WK.save.write(); WK.renderScene();
      if(WK.EVENTS.n12_B_jd_saved) WK.EVT.run("n12_B_jd_saved");
    },

    resolveDeath(){
      const p=WK.P,c=this.activeDef(); if(!p||!c)return;
      const npc=c.npc;
      p.flags[c.flag]="dead"; delete p.flags._rescueActive;
      const st=WK.npcState(npc); if(st) st.struggle=false;
      this._advanceStation();
      WK.story.die(npc,(WK.NPCS[npc]?WK.NPCS[npc].name:npc)+"没能撑住，被涌上的丧尸拖进下水道黑水里，惨叫很快被撕咬声吞没。");
      WK.save.write(); WK.renderScene();
    }
  };

