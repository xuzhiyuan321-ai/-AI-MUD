/* ============================================================
 * 02-bio1.js — 生化一副本
 * 主线阶段、剧情事件管道、N8-N12剧情、A/B双路线结局
 * ============================================================ */

  /* ============================================================
   * 豆包N8：主线阶段枚举 + NPC 剧情站位调度
   * ------------------------------------------------------------
   * P.stage 为当前主线阶段号（枚举见 WK.STORY.STAGES）。N8 只负责「到了某阶段，
   * 各个还活着的剧情人物应该站在哪个房间」；具体对白/死亡/战斗由 N9 事件管道、
   * N10-12 正式剧情触发，不在推进阶段时抢跑。
   *
   * 站位解析优先级（WK.story.posAt）：
   *   1) schedule[id][stage] 显式指定（个体剧情，如雷恩返程尸变、瑞恩在列车）
   *   2) 属于马修小队/随队轮回者 → SQUAD_PATH[stage] 主动线
   *   3) 红后永远在 core_room
   *   4) 都没有 → 返回 null（保持原地）
   * 已入玩家队伍（郑吒/詹岚）者 applyStage 时跳过：跟随优先（WK.party.follow），
   * 除非剧情强制（A/B 分线时由 N12 用 moveNpc/leave 单独处理）。
   * stage 0（行驶列车）不重定位，保留各 NPC 的 home 初始站位。
   * ============================================================ */
  WK.STORY = {
    STAGES:{ TRAIN:0, PLATFORM:1, STAIRS:2, LAB:3, DINING:4, CONTROL:5, LASER:6,
             CORE:7, SPLIT:8, SEWER:9, RETURN:10, FINAL:11, GODSPACE:12 },
    STAGE_NAMES:{ 0:"行驶列车·苏醒", 1:"地面站台", 2:"下行楼梯井", 3:"实验研究区",
      4:"B 餐厅·储柜区", 5:"操纵室", 6:"激光通道", 7:"主机房·关闭红后",
      8:"路线分叉", 9:"下水道 / 死守主机房", 10:"返程列车", 11:"最终战", 12:"主神空间" },

    /* 豆包v117：「搭话」分阶段情境兜底台词。
       NPC 没在 def.talks[stage] 提供专属台词时，按其阵营 + 当前阶段取这里的句子，
       保证任何时候搭话都符合当下、绝不会把列车开场的话带到餐厅/主机房（不穿帮）。
       只做情境白描与呼应，不新增原著没有的情节；要给某角色写专属口吻，在其 talks 里覆盖。 */
    STAGE_IDLE:{
      1:{ reincarn:"他盯着那扇通往地底的钢门，压低声音：「跟紧，别乱看，也别乱问。」",
          movie:"他正检查装备、盯着破解大门的进度，神情紧绷，只向你这边瞥了一眼。" },
      2:{ reincarn:"他一边随队全速向下狂奔，一边低吼：「停就是死——跟上！」",
          movie:"队伍一级级跨越台阶，他呼吸越来越重，只顾向下，顾不上和你说话。" },
      3:{ reincarn:"他望着玻璃后那些白森森的浮尸，脸色发白：「这些东西……等会儿全会爬起来。」",
          movie:"培养液里的白影让他握紧了枪，警惕地盯着整面玻璃墙。" },
      4:{ reincarn:"他压低声音：「这地方封着的，可比丧尸麻烦十倍。离那些箱子远点。」",
          movie:"集装箱深处传来低响，他举枪对准一排排绿色指示灯，屏息戒备。" },
      5:{ reincarn:"他看着满墙监控：「马上要过那条要命的走廊了……记住，别抢在最前面。」",
          movie:"他守在指挥操纵室，盯着满墙屏幕，等待关闭火焰女皇的下一步。" },
      6:{ reincarn:"他声音发紧：「就是这里。等会儿不管看到什么，都别往那条通道里冲。」",
          movie:"惨白狭长的通道让他浑身僵硬，暗处的感应线泛着冰冷的光。" },
      7:{ reincarn:f=>f.redqueenOff ? "「她被关掉了——所有锁着的门同时打开，丧尸也会一起涌出来。准备好。」"
                                    : "他望着旋转的六边形核心：「关掉她，门才会开，但那些东西也会被一起放出来。」",
          movie:f=>f.redqueenOff ? "火焰女皇的主机归于沉寂，他沉默地盯着熄灭的全息台。"
                                 : "无数六边形核心在中央旋转，映着冷蓝的光，他盯着火焰女皇的主机神色复杂。" },
      8:{ reincarn:"他看向你：「留守主机房，还是走下水道？这一步，决定谁能活着回去。」",
          movie:"队伍起了分歧，他在等队长的命令，目光在主机房与检修口之间游移。" },
      9:{ reincarn:"他把枪上膛：「来了。撑到手表归零，我们就算赢。」",
          movie:"他已经就位，背靠大门/贴着污水管壁，准备迎接即将冲上来的东西。" },
      10:{ reincarn:"「坐稳——还有东西，在追这辆车。」",
          movie:"列车在隧道里狂奔，他死死抓着扶手，警惕着每一节车厢的动静。" },
      11:{ reincarn:"他嘶吼：「打它的头！别退，退就是死！」",
          movie:"那只怪物已经逼近，他正全力开火、死战不退。" },
      12:{ reincarn:"他站在巨大的光团下，长出一口气：「活下来了。去光球那儿，把点数变成活下去的资本。」",
          movie:"（剧情里的人已留在原来的世界，此刻不该出现在这里。）" }
    },

    /* 马修小队（雇佣兵 + 被押解的艾丽丝/瑞恩/马特）与随队轮回者的统一主动线。
       stage 0 给 null＝保持列车 home；分叉(8)以后默认 A 线（留守主机房），
       B 线人物由 N12 选线后 moveNpc 搬到下水道/返程列车。 */
    SQUAD_PATH:{ 0:null, 1:"pm_hall", 2:"s_50", 3:"l_hall", 4:"d_gate",
      5:"c_room", 6:"c_laserin", 7:"core_room", 8:"core_room", 9:"core_room",
      10:"core_room", 11:"core_door", 12:"g_plaza" },

    /* 哪些人走这条主动线（几乎所有随队者；郑吒/詹岚入队后被 applyStage 跳过）*/
    SQUAD:["matthew","rain","jd","kaplan","alice","ryan","matt",
           "zhangjie","mougang","lixiaoyi","fatty","woman","zhengzha","zhanlan"],

    /* 个体覆盖（稀疏）：仅在主动线不符合该人物时填写。
       雷恩：在 B 餐厅/研究区被咬（stage4 起在 d_floor 一带），返程 B 线在列车尸变。
       瑞恩/马特/艾丽丝：随队直到主机房；走 B 线返程时在列车（N12 显式搬）。 */
    SCHEDULE:{
      rain:  { 4:"d_floor", 5:"c_room", 6:"c_laserin" },
      ryan:  { 11:"tb_train" },
      matt:  { 11:"tb_train" },
      alice: { 11:"tb_train" }
    }
  };

  WK.story = {
    posAt(id, stage){
      const def = WK.NPCS[id]; if (!def) return null;
      if (id === "redqueen") return "core_room";
      const ov = WK.STORY.SCHEDULE[id];
      if (ov && ov[stage] !== undefined) return ov[stage];
      if (WK.STORY.SQUAD.indexOf(id) >= 0) {
        const r = WK.STORY.SQUAD_PATH[stage];
        return (r && WK.ROOMS[r]) ? r : null;
      }
      return null;
    },

    /* 把所有「活着、不在玩家队伍」的剧情人物摆到 stage 对应位置。
       opts.includeParty=true 时连队友也强制归位（A/B 分线剧情用）。*/
    applyStage(stage, opts){
      opts = opts || {};
      const moved = [];
      Object.keys(WK.NPCS).forEach(id => {
        const st = WK.npcState(id); if (!st || !st.alive) return;
        if (!opts.includeParty && WK.party.has(id)) return; // 队友跟随优先
        const loc = this.posAt(id, stage);
        if (loc && st.loc !== loc) { st.loc = loc; moved.push({ id:id, to:loc }); }
      });
      return moved;
    },

    /* 单人强制移动（N12 分线/事件用），无视主动线 */
    moveNpc(id, roomId){
      const st = WK.npcState(id); if (st && WK.ROOMS[roomId]) { st.loc = roomId; return true; }
      return false;
    },
    /* 剧情死亡：离队（若在队）+ alive=false。reason 写日志 */
    die(id, reason){
      const def = WK.NPCS[id];
      if (WK.party.has(id)) WK.party.leave(id, null, WK.npcState(id) ? WK.npcState(id).loc : null);
      const st = WK.npcState(id); if (st) st.alive = false;
      WK.log("danger", reason || ((def ? def.name : id) + " 死亡。"));
      return true;
    },

    /* 阶段钩子：N9 事件管道/N10-12 注册 onEnter(stage, fn)，推进时依次执行 */
    _hooks:{},
    onEnter(stage, fn){ (this._hooks[stage] = this._hooks[stage] || []).push(fn); },

    /* 推进（或回退，测试用）主线阶段：写 P.stage、批量站位、存档、重渲染、跑钩子。
       opts.silent=true 不写场景日志；opts 透传给 applyStage。返回 {stage,moved,hooks}。*/
    goToStage(stage, opts){
      opts = opts || {};
      const prev = WK.P.stage;
      WK.P.stage = stage;
      const moved = this.applyStage(stage, opts);
      WK.save.write();
      if (typeof WK.renderScene === "function") WK.renderScene();
      if (!opts.silent)
        WK.log("quest", "【剧情阶段】" + WK.STORY.STAGE_NAMES[stage] +
          (prev !== stage ? ("（" + prev + " → " + stage + "）") : ""));
      (this._hooks[stage] || []).forEach(fn => { try { fn(WK.P); } catch(e){ console.error("stage hook", stage, e); } });
      let evId=null; if (WK.EVT) evId=WK.EVT.check("stage"); // 豆包N9：进阶段触发剧情
      return { stage:stage, moved:moved, hooks:(this._hooks[stage]||[]).length, event:evId };
    }
  };

  /* ============================================================
   * 豆包N9：剧情事件管道（剧本引擎）
   * ------------------------------------------------------------
   * 目标：支撑 N10-12 大量「逐字对齐原著」的连续剧情，而不必每段都手写弹窗。
   * 复用 ov-dialog，做成视觉小说式「对话气泡流」：对白逐句累积、自动滚底，
   * 关键处弹出玩家可选回复，回复经「动作原语」改变 旗标/阶段/位置/队伍/
   * 好感/点数/存档，或触发战斗（战斗期间事件挂起，结束后自动续播）。
   *
   * 剧本结构（WK.EVT.run(script)）：
   *   script = { id:'事件id(用于 once 去重)', lock:true 是否禁移动(强制剧情),
   *              steps:[ step, ... ], onDone:function(P){} }
   *   step 类型：
   *     { label:'名字' }                       跳转锚点（自身不显示，自动略过）
   *     { who:'npcId', say:'台词' }            NPC 说话（自动取名/阵营色）
   *     { me:'我说的话' }                       玩家发言（绿色「我」）
   *     { narr:'旁白/场景描写' }               旁白（青色）
   *     { god:'主神提示' }                      主神（金色）
   *     { act:[ 动作, ... ] }                  静默执行一串动作后自动续播
   *     { choices:[ {text, show:fn, do:[动作], goto:'label'|index|'end'}, ... ] }
   *   选项不写 goto：执行 do 后继续下一步；写 goto 跳转。show 返回 false 的选项隐藏。
   *
   * 动作原语（字符串简写 或 数组）：
   *   'flag:名'  ['flag','名',值]   set 剧情旗标
   *   ['stage', n]                  推进主线阶段（同时跑 N8 站位）
   *   ['goto','roomId']            剧情把玩家移动到某房（静默，不再触发 enter 事件防环）
   *   ['join','id'] ['leave','id'] ['die','id','原因']
   *   ['favor','id',n] ['points',n,'原因'] ['log','type','文本']
   *   ['watch']                    启动主神手表倒计时
   *   ['foreshow','标题','内容']   触发记忆闪回
   *   ['battle', { ...WK.battle.start 的 opts } ]   开战；事件挂起，结束自动续播
   *                                 （opts.defeatMode/onDefeat 仍生效，A 线特殊战用）
   *   ['fn','注册名']              调 WK.EVT.fnLib.注册名(P)，处理特别复杂的剧情
   *   'end'                        立即结束本事件
   *
   * 触发：WK.EVENTS 注册表（N10-12 填正式事件）。进房(goDir)/推进阶段(story.goToStage)
   *   后调 WK.EVT.check(trigger)，命中 when 且 once 未完成即播放。测试 teleport 不触发。
   * ============================================================ */
  WK.EVENTS = {};  // { eventId:{ once:true, when:{room/stage/flag/notFlag}, script:对象或fn(P)->剧本 }

  WK.EVT = {
    cur:null,        // 当前运行上下文 {id,steps,idx,labels,lock,done,onDone,suspended}

    /* —— 播放一个剧本（对象）或注册表里的 id —— */
    run(scriptOrId, opts){
      opts = opts || {};
      let sc = (typeof scriptOrId === "string") ? WK.EVENTS[scriptOrId] : scriptOrId;
      if (!sc) return false;
      if (typeof sc.script === "function") sc = Object.assign({}, sc, { script:sc.script(WK.P) });
      const inner = sc.script || {};
      const steps = sc.steps || inner.steps || [];
      if (this.cur && this.cur.active) return false;  // 已有剧情播放中
      const id = sc.id || inner.id || (typeof scriptOrId === "string" ? scriptOrId : ("ev_" + Date.now()));
      // 标签 → 步骤下标
      const labels = {}; steps.forEach((stp,i)=>{ if (stp && stp.label) labels[stp.label] = i; });
      this.cur = { id:id, steps:steps, idx:-1, labels:labels, active:true, suspended:false,
                   lock:!!(sc.lock || inner.lock || opts.lock), onDone:sc.onDone||inner.onDone||opts.onDone||null, regId:(typeof scriptOrId==="string"?scriptOrId:null) };
      // 清空对话流容器
      document.getElementById("dialog-body").innerHTML = '<div class="dlg-flow" id="dlg-flow"></div>';
      document.getElementById("dialog-actions").innerHTML = "";
      document.getElementById("dialog-name").textContent = sc.title || inner.title || "剧情";
      document.getElementById("ov-dialog").classList.add("active");
      this._scrollDialog(true);   // 豆包v121：新开一段剧情，滚动容器回顶
      this.next();
      this._fastStop();          // 豆包v125：先清掉上一段残留的快进泵，再按本局是否重生者决定是否启动
      this._fastStart();
      return true;
    },

    /* 豆包v127：重生者·剧情快进泵（规则：跳大段、留短句）。
       开局取名可勾「我是重生者」（P.flags.reborn，系统面板可随时开关）。开启后每 70ms 检查：
         · 大段设定/长对白/长旁白、主神规则提示、act 动作——立即快进；
         · 短对白 / 短旁白（≤28 字）与标了 fast:false 的关键提示——按字数停留 0.65~2.6 秒，看得清再续播；
         · 有【选项】（c._awaitChoice）、剧情挂起（suspended，通常是战斗）、上层模态
           （ov-generic：激光 QTE、苦战营救）——永久停住等玩家。
       每句停留多久由 _fastHoldFor(s) 统一决定；玩家点「继续」随时可立刻翻下一句，不被停留卡住；
       正文逐句渲染、可上翻回看。 */
    _fastStart(){
      if (!WK.P || !WK.P.flags || !WK.P.flags.reborn) return;
      this._fastStop();
      this._fastTimer = setInterval(() => this._fastPump(), 70);
    },
    _fastStop(){ if (this._fastTimer) { clearInterval(this._fastTimer); this._fastTimer = null; } },
    _fastPump(){
      const c = this.cur;
      if (!c || !c.active) { this._fastStop(); return; }
      if (c.suspended) return;
      const gen = document.getElementById("ov-generic");
      if (gen && gen.classList.contains("active")) return;
      if (c._awaitChoice) return;
      if (Date.now() < (c._fastHoldUntil || 0)) return;   // 剧情句最短停留中，等它够读
      this.next();
    },

    /* 豆包v121：对话自动滚动。
       真正带滚动条的是 #dialog-body 的父容器 .overlay-body（overflow-y:auto），
       #dialog-body 本身高度随内容撑开、并不滚动——v120 及以前误滚了它，导致点「继续」不跟到底。
       reset=true 回到顶部（新事件）；否则滚到最新一句。下一帧再滚一次，吃掉淡入动画/换行的高度差。 */
    _scrollDialog(reset){
      const body = document.getElementById("dialog-body");
      const sc = body ? body.closest(".overlay-body") : null;
      if (!sc) return;
      const apply = () => { sc.scrollTop = reset ? 0 : sc.scrollHeight; };
      apply();
      requestAnimationFrame(() => requestAnimationFrame(apply));
    },

    /* —— 推进一步：跳过 label，取下一条可显示/执行的 step —— */
    next(){
      const c=this.cur; if(!c||c.suspended) return;
      c.idx++;
      if (c.idx >= c.steps.length) { this.finish(); return; }
      let s=c.steps[c.idx];
      if (s && s.label) { this.next(); return; }
      this.render(s);
    },
    goto(target){
      const c=this.cur; if(!c) return;
      if (target==="end") { this.finish(); return; }
      c.idx = (typeof target === "number") ? target : (c.labels[target] !== undefined ? c.labels[target] : c.idx);
      this.next();
    },

    /* 豆包v118：文案模板。{name} → 玩家注册名（未取名＝无名），再交给 _esc 转义 */
    tmpl(t){ return String(t==null?"":t).replace(/\{name\}/g, WK.playerName ? WK.playerName() : "无名"); },

    /* —— 渲染当前 step —— */
    render(s){
      const c=this.cur, flow=document.getElementById("dlg-flow"), acts=document.getElementById("dialog-actions");
      acts.innerHTML="";
      c._awaitChoice=false;   // 豆包v125：默认非选项步；下面渲染到 choices 再置 true，供快进泵判断是否停下
      if (s.who) {
        const def=WK.NPCS[s.who], meta=def?({reincarn:["#d8b15a"],movie:["#5fae9d"],ai:["#b794e0"]}[def.camp]||["#9fb0a6"]):["#9fb0a6"];
        flow.insertAdjacentHTML("beforeend",
          '<div class="dlg-bub"><div class="dlg-who" style="color:'+meta[0]+'">'+(def?def.name:s.who)+'</div>'+
          '<div class="dlg-say">'+this._esc(this.tmpl(s.say))+'</div></div>');
      } else if (s.me) {
        flow.insertAdjacentHTML("beforeend",
          '<div class="dlg-bub dlg-mine"><div class="dlg-who">我</div><div class="dlg-say">'+this._esc(this.tmpl(s.me))+'</div></div>');
      } else if (s.narr) {
        flow.insertAdjacentHTML("beforeend",
          '<div class="dlg-bub dlg-narr"><div class="dlg-say">'+this._esc(this.tmpl(s.narr))+'</div></div>');
      } else if (s.god) {
        flow.insertAdjacentHTML("beforeend",
          '<div class="dlg-bub dlg-god"><div class="dlg-who" style="color:var(--god);">主神</div><div class="dlg-say">'+this._esc(this.tmpl(s.god))+'</div></div>');
      } else if (s.act) {
        this.execList(s.act);
        if (!c.suspended) this.next();   // 若动作开了战（挂起），等战后 resume
        return;
      }

      if (s.choices) {
        const box=document.createElement("div"); box.className="dlg-choice";
        s.choices.forEach((opt,oi)=>{
          if (opt.show && !opt.show(WK.P)) return;
          const b=document.createElement("button"); b.className="here-btn"+(opt.primary?" primary":"");
          b.textContent=this.tmpl(opt.text);
          b.onclick=()=>this.choose(oi);
          box.appendChild(b);
        });
        // 只保留当前可见选项的索引映射
        c._visible=s.choices.map((o,i)=>(!o.show||o.show(WK.P))?i:-1).filter(i=>i>=0);
        acts.appendChild(box);
        c._awaitChoice=true;   // 豆包v125：重生者快进到此必须停住，等玩家亲自选
      } else {
        const b=document.createElement("button"); b.className="here-btn primary";
        b.textContent = s.continueText || "继续"; b.onclick=()=>this.next(); acts.appendChild(b);
      }
      this._scrollDialog(false);   // 豆包v121：新增一句后自动滚到最新（含玩家选择后）
      // 豆包v127：重生者快进的每句停留时间交给纯函数 _fastHoldFor 判定（大段跳、短句停），见该函数注释。
      c._fastHoldUntil = (WK.P && WK.P.flags && WK.P.flags.reborn)
        ? Date.now() + this._fastHoldFor(s) : 0;
    },

    /* 豆包v127：重生者模式下，当前这句该「停留多少毫秒给人看」。0 = 立刻快进跳过。
       设计原则（lon 反馈）：只跳大段、别把短剧情闪没；但也不能句句都停，否则跟手动没区别。
         · 选项 choices                       →0（选项由 _awaitChoice 永久拦住，不靠停留）
         · 标了 fast:true 的大段设定/铺陈      →0，一闪即过
         · 角色对白 who / 玩家口吻 me / 旁白 narr：
             - 短句（≤28 字）才停留（0.65~2.6 秒，按字数），短对白短剧情看得清；
             - 长句视为「大段」，直接跳过（重生者已知剧情）。
         · 主神规则 god 默认跳过；仅显式标 fast:false 的关键操作提示才停留（不限长度）。
         · act 动作 →0。
       以后想让某句大段也必停，给它加 fast:false；想让某句流水旁白强制跳，加 fast:true。 */
    _fastHoldFor(s){
      if (!s || s.choices) return 0;
      const SHORT = 28;
      if (s.fast === true) return 0;
      let text = "";
      if (s.fast === false) {
        text = s.god || s.say || s.me || s.narr || "";     // 关键提示：再长也停
      } else if (s.who || s.me || s.narr) {
        text = s.say || s.me || s.narr || "";
        if (text.length > SHORT) return 0;                 // 长对白/长旁白＝大段，跳过
      } else {
        return 0;                                          // 默认 god 规则句、act：跳过
      }
      if (!text) return 0;
      return Math.min(2600, 650 + text.length * 95);
    },

    choose(visibleIdx){
      const c=this.cur; const oi=c._visible ? c._visible[visibleIdx] : visibleIdx;
      const opt=c.steps[c.idx].choices[oi]; if(!opt) return;
      // 玩家把所选回复也显示成气泡（增强代入）
      if (opt.me!==false && opt.text)
        document.getElementById("dlg-flow").insertAdjacentHTML("beforeend",
          '<div class="dlg-bub dlg-mine"><div class="dlg-who">我</div><div class="dlg-say">'+this._esc(this.tmpl(opt.text))+'</div></div>');
      if (opt.do) this.execList(opt.do);
      if (c.suspended) return;          // 开战了，等战后续
      if (opt.goto!==undefined) this.goto(opt.goto); else this.next();
    },

    /* —— 动作执行 —— */
    execList(list){ (list||[]).forEach(a=>this.exec(a)); },
    exec(a){
      const p=WK.P;
      if (a==="end") { this.finish(); return; }
      if (typeof a==="string") {
        if (a.indexOf("flag:")===0){ p.flags[a.slice(5)]=true; WK.save.write(); return; }
        return;
      }
      const [op,...args]=a;
      switch(op){
        case "flag": p.flags[args[0]] = (args[1]===undefined?true:args[1]); WK.save.write(); break;
        case "stage": WK.story.goToStage(args[0], { silent:true }); break;
        case "goto": WK.teleport(args[0], true); break;       // 静默移动，不再触发 enter
        case "join": WK.party.join(args[0], args[1]||"", {force:true}); break;
        case "leave": WK.party.leave(args[0], null, args[1]); break;
        case "die": WK.story.die(args[0], args[1]); break;
        case "favor": p.favor[args[0]]=(p.favor[args[0]]||0)+args[1]; WK.save.write(); break;
        case "points": WK.rules.addPoints(args[0], args[1]||"剧情"); break;
        case "log": WK.log(args[0]||"sys", args[1]||""); break;
        case "watch": if(WK.rules.startWatch) WK.rules.startWatch(); break;
        case "foreshow": WK.foreshow(args[0], args[1]); break;
        case "fn": if(WK.EVT.fnLib[args[0]]) WK.EVT.fnLib[args[0]](p); break;
        case "battle": {
          const bopts=Object.assign({}, args[0]||{});
          const c=this.cur;
          const userWin=bopts.onWin, userDefeat=bopts.onDefeat;
          bopts.onWin=()=>{ if(userWin)userWin(p); this.resume(); };
          bopts.onDefeat=()=>{ if(userDefeat)userDefeat(p); this.resume(); };
          c.suspended=true;
          WK.ui.closeOverlay("ov-dialog");
          WK.battle.start(bopts.room || p.location, bopts);
          break;
        }
        default: console.warn("EVT 未知动作", a);
      }
    },
    /* 战斗等异步动作结束后续播 */
    resume(){ const c=this.cur; if(!c) return; c.suspended=false;
      document.getElementById("ov-dialog").classList.add("active"); this.next(); },

    finish(){
      const c=this.cur; if(!c) return;
      this._fastStop();       // 豆包v125：剧情结束，停掉重生者快进泵
      if (c.regId) { WK.P.evDone[c.regId]=true; WK.save.write(); }
      const cb=c.onDone;
      c.active=false; this.cur=null;
      WK.ui.closeOverlay("ov-dialog");
      if (cb) cb(WK.P);
    },

    /* —— 触发器：进房 / 阶段推进 时调用 —— */
    check(trigger, data){
      data=data||{};
      if (this.cur && this.cur.active) return null;  // 播放中不打断
      const p=WK.P, room=data.room||p.location, stage=p.stage;
      for (const id in WK.EVENTS) {
        const ev=WK.EVENTS[id];
        const w=ev.when;
        // 豆包N12：没有 when.trigger 的事件只能被 EVT.run(id) 显式调起，不参与自动触发
        if (!w || !w.trigger) continue;
        // 豆包v168：manual 事件只能由玩家主动行为（如点 NPC「问话」）显式 EVT.run 拉起，
        // 进房/推进阶段的自动 check 不得替玩家弹窗——这是「剧情门控」的一部分（读档也靠它续）。
        if (ev.manual) continue;
        if (w.trigger && w.trigger!==trigger) continue;
        if (w.room && w.room!==room) continue;
        if (w.stage!==undefined && w.stage!==stage) continue;
        if (w.flag && !p.flags[w.flag]) continue;
        if (w.notFlag && p.flags[w.notFlag]) continue;
        if (w.if && !w.if(p)) continue;
        if (ev.once!==false && p.evDone[id]) continue;
        if (this.run(id)) return id;
      }
      return null;
    },
    _esc(t){ return String(t==null?"":t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); },
    /* 复杂剧情自定义函数库（N10-12 注册，例如激光 QTE、A 线连串警报）*/
    fnLib:{}
  };

  /* ============================================================
   * 豆包N10：正式剧情 · 第一集前段
   * ------------------------------------------------------------
   * 覆盖 zhttty《无限恐怖》第一集「名为生化」前两章（小说）/ 电影《生化危机1》
   * 列车—站台—五十层楼梯。对白与事件严格对齐原著（玩家是被主神塞进来的
   * 「第八名新人」，看过电影，专属机制＝记忆闪回；原著对白仍由原人物说出，
   * 玩家选项只表达自己的反应/预知，不篡改 canonical 问答）。
   *
   * 节奏：开场(n10_wake，v168 改为在苏醒车厢点张杰主动问话触发) → 站台讲解(enter pm_hall)
   *      → 50层下楼里程碑(enter 指定楼层) → 抵达底层(enter s_bottom)，推进到 stage3。
   * 锚点：列车停时手表锁定「马修-艾迪森」、3小时倒计时开始；下楼途中若玩家
   *      持续向上爬（掉队），STORY10.onStairEnter 累加锚点距离，>100m 抹杀。
   * 原著必死者：小胖子、中年妇女下楼掉队脱离锚点被炸（n10_s31，无法挽回）。
   * ============================================================ */
  let squadTimer = null;   // 豆包v116：下楼梯段大部队行进定时器（每秒一层）；不进存档，读档由 resumeSquad 重建
  WK.STORY10 = {
    /* ===== 豆包v116：马修大部队「真的在下楼」行进系统 =====
       玩家进 s_50 后启动：先锋楼层 _squadFloor 每 1 秒 -1，直到底层(0)。
       锚点距离 = max(0, 玩家楼层 - 先锋楼层) × 每层米数，单一真源每秒重算；
       玩家点「南」下楼即时追回；原地不动，距离每秒拉开一层（脱离马修 100 米抹杀）。
       看剧情对话框 / 战斗中队伍暂停，不会因为你读字就被甩死。 */
    floorOf(roomId){
      if (roomId === "s_bottom") return 0;
      const m = /^s_(\d{2})$/.exec(roomId || "");
      return m ? parseInt(m[1], 10) : null;
    },
    floorRoom(f){ return f <= 0 ? "s_bottom" : ("s_" + (f < 10 ? "0" + f : "" + f)); },

    /* goDir 每次移动后调：更新拉扯距离 + 同步队伍 + 向上爬警告
       豆包v120：锚点距离是独立累加器——向南追一层，独自追回 3 米/搀人只追回 1 米；
       大部队每秒 +3 米（在 _squadTick）。不再用楼层差实时重算，避免手速快反超后难度被清零。 */
    onPlayerMove(dir){
      const p = WK.P; if (!p || p.stage !== 2 || p.flags._squadFloor === undefined) return;
      const onStair = /^s_\d{2}$/.test(p.location);
      if (p.anchor.active) {
        if (dir === "S" && onStair) {
          const catchM = this._assisting() ? WK.RULES.assistCatchPerFloor : WK.RULES.stairMetersPerFloor;
          p.anchor.distance = Math.max(0, (p.anchor.distance || 0) - catchM);
          if (this._assisting()) p.flags._assistFloors = (p.flags._assistFloors || 0) + 1;
        } else if (dir === "N" && onStair) {
          p.anchor.distance = (p.anchor.distance || 0) + WK.RULES.stairMetersPerFloor;
        }
      }
      this.syncSquadNpcs();
      if (dir === "N" && onStair) {
        WK.toast("你在往回爬，正在远离马修小队！（" + Math.round(p.anchor.distance) + " 米）", "bad");
        if (p.anchor.distance > 60)
          WK.log("danger", "身后上方隐约传来不属于脚步的闷响——再掉队，你会和那两个人一个下场。");
      }
      WK.rules.checkAnchor();
      if (WK.renderWatchHUD) WK.renderWatchHUD();   // 豆包v124：每下/上一层立刻刷新顶栏「距马修 Xm」
      // 豆包v120：搀扶小胖/妇女，每下 assistRestEvery 层弹「走不动了」（不暂停大部队，须点掉才能继续）
      if (dir === "S" && this._assisting() && this._assistHeavy() && !p.flags._restPending &&
          (p.flags._assistFloors % WK.RULES.assistRestEvery) === 0 && this.floorOf(p.location) > 0) {
        this._openRestPrompt(p.flags._assistWho);
      }
      if (this.floorOf(p.location) === 0) {
        // 玩家抵达底层：在底层大厅集结，距离清零、队伍停表（避免手速快时马修还停在楼上）
        p.flags._squadFloor = 0; this.syncSquadNpcs();
        p.anchor.distance = 0; this.stopSquad(); this._closeRestPrompt(true);
        if (WK.renderWatchHUD) WK.renderWatchHUD();
      }
    },

    /* 距离已是独立累加器，这里只做下限钳制 + 抹杀判定（读档/跨阶段调用安全；不再按楼层差重算）。*/
    recalcAnchor(){
      const p = WK.P;
      if (!p || p.stage !== 2 || !p.anchor.active || p.flags._squadFloor === undefined) return;
      p.anchor.distance = Math.max(0, p.anchor.distance || 0);
      WK.rules.checkAnchor();
    },

    /* 豆包v120：当前是否处于「搀扶一人下楼」状态（_assistWho 为三个可搀扶者之一）*/
    _assisting(){
      const p = WK.P;
      return !!(p && p.stage === 2 && p.flags._squadFloor !== undefined &&
        ["fatty","woman","zhanlan"].indexOf(p.flags._assistWho) >= 0);
    },
    /* 被搀扶者是否为体力差、会「走不动要歇息」的类型（小胖/中年妇女）；詹岚只减速不弹歇息 */
    _assistHeavy(){ const w = WK.P ? WK.P.flags._assistWho : null; return (w === "fatty" || w === "woman"); },

    startSquad(){
      const p = WK.P; if (!p) return;
      if (p.flags._squadFloor === undefined) p.flags._squadFloor = 50;
      this.syncSquadNpcs();
      if (squadTimer) return;
      squadTimer = setInterval(() => this._squadTick(), WK.RULES.squadStepMs);
    },
    stopSquad(){ if (squadTimer) { clearInterval(squadTimer); squadTimer = null; } },

    /* 读档/跨刷新后仍在下楼段即恢复行进（含 sf=0：马修已在底层但仍不等掉队者，距离继续计）*/
    resumeSquad(){
      const p = WK.P;
      if (p && p.stage === 2 && p.flags._squadFloor !== undefined) {
        this.syncSquadNpcs(); this.recalcAnchor();
        if (!squadTimer) squadTimer = setInterval(() => this._squadTick(), WK.RULES.squadStepMs);
      }
    },

    _squadTick(){
      const p = WK.P;
      if (!p || p.dead || p.stage !== 2 || p.flags._squadFloor === undefined) { this.stopSquad(); return; }
      if (WK.EVT && WK.EVT.cur && WK.EVT.cur.active) return;   // 你在看剧情，队伍等你
      if (WK.battle && WK.battle.state && WK.battle.state.active) return;  // 战斗中暂停
      let sf = p.flags._squadFloor;
      if (sf > 0) {
        sf -= 1; p.flags._squadFloor = sf;
      }
      // 豆包v120：每过一拍距离 +3 米——即使马修已站在底层(sf=0)也不等掉队者，
      // 否则慢玩家可以在队伍到底后无限磨距离、把救人变成零风险。停止只靠：玩家到底/死亡/离开本阶段。
      if (p.anchor.active) p.anchor.distance = (p.anchor.distance || 0) + WK.RULES.stairMetersPerFloor;
      this.syncSquadNpcs();
      WK.rules.checkAnchor();
      if (WK.renderWatchHUD) WK.renderWatchHUD();
    },

    /* NPC 真的在楼梯上移动：马修与电影队/张杰在先锋层，郑吒在你身侧。
       豆包v120：詹岚——你搀着就跟你，你不搀她便去拉郑吒（郑吒在你身侧，故她仍在近旁）；
       被你搀扶的小胖子/中年妇女贴着你一层层挪；没被搀扶的那一个留在原地掉队（s31 被抹杀）。*/
    syncSquadNpcs(){
      const p = WK.P; if (!p || !p.npcs) return;
      const sf = (p.flags._squadFloor === undefined) ? 50 : p.flags._squadFloor;
      const front = this.floorRoom(sf);
      const move = (id, room) => {
        const n = p.npcs[id];
        if (n && n.alive !== false && WK.ROOMS[room]) n.loc = room;
      };
      ["matthew","alice","rain","jd","kaplan","matt","zhangjie"].forEach(id => move(id, front));
      move("zhengzha", p.location);
      move("zhanlan", p.location);
      if (p.flags._assistWho === "fatty") move("fatty", p.location);
      if (p.flags._assistWho === "woman") move("woman", p.location);
    },

    /* ===== 豆包v120：s42「四选一搀扶」初始化（fn 原语 assistFatty/assistWoman/assistZhanlan/assistNone 调）===== */
    assistStart(who){
      const p = WK.P; if (!p) return;
      p.flags._assistWho = who;
      p.flags._assistFloors = 0;
      p.flags._assistLag = 0;
      p.flags._restPending = false;
      // 两人此刻都体力不支、落在 s_42；谁被你搀起，谁之后跟你走，另一个就留在这儿掉队
      ["fatty","woman"].forEach(id => { const n = p.npcs[id]; if (n && n.alive !== false) n.loc = "s_42"; });
      if (who === "fatty") {
        p.favor.fatty = (p.favor.fatty || 0) + 2;
        p.flags.savedFatty = true;   // 豆包v122：永久「被你救下」标记——日后他才有资格入队（clearAssist 也不清）
        WK.toast("你架住了小胖子", "gold");
        WK.log("team", "小胖子又惊又喜，肥硕的胳膊死死箍住你的肩膀：「好、好兄弟……我这条命，是你的了！」");
      } else if (who === "woman") {
        p.favor.woman = (p.favor.woman || 0) + 2;
        p.flags.savedWoman = true;   // 豆包v122：永久「被你救下」标记——她日后才有资格入队
        WK.toast("你架住了中年妇女", "gold");
        WK.log("team", "中年妇女的眼泪一下涌出来，混着汗往下淌：「好人……你真是好人啊……」");
      } else if (who === "zhanlan") {
        p.favor.zhanlan = (p.favor.zhanlan || 0) + 2;
        p.favor.zhengzha = (p.favor.zhengzha || 0) + 1;  // 豆包v125：你肯回头拉詹岚，郑吒看在眼里、高看你一眼
        WK.toast("你向詹岚伸出了手", "gold");
        WK.log("team", "詹岚怔了一下，随即紧紧攥住你的手：「……谢谢。」郑吒在旁看了你一眼，重重点头跟上。");
      } else {
        WK.log("sys", "你咬着牙谁也顾不上，埋头自顾自向下冲。身后的喘息声越来越远。");
        WK.log("sys", "詹岚脚下一软，郑吒回身一把将她拉住，半拖半带着她跟了上来。");
      }
      if (who !== "none") {
        WK.log("sys", "架着一个人，你每下一层都格外吃力——独自走能甩开的距离，现在只能追回三分之一，必须更拼命地往下赶。");
        if (who === "fatty" || who === "woman")
          WK.log("sys", "他体力实在太差，每隔几层就要瘫一次，你得一次次把他硬拽起来，半点由不得他休息。");
      }
      WK.save.write();
      this.syncSquadNpcs(); this.recalcAnchor();
      if (WK.renderWatchHUD) WK.renderWatchHUD();
    },

    /* 「走不动了，要歇息」内联弹窗：刻意不挂 EVT.cur，故大部队仍在下楼、锚点距离继续拉开——
       玩家必须尽快点「再坚持一下」，这正是救人比单走更难的地方。 */
    _openRestPrompt(who){
      const p = WK.P; if (!p || p.dead) return;
      p.flags._restPending = true; WK.save.write();
      const def = WK.NPCS[who] || { name:"那人", ava:"?" };
      const line = (who === "fatty")
        ? "「我……我不行了……让我坐会儿……就坐一小会儿……」他脸色酱紫，瘫在台阶上，浑身的肉都在抖。"
        : "「大姐不中用了……腿、腿不是我的了……让我歇口气……」她抓着扶手，整个人顺着墙往下滑。";
      WK.ui.generic("下楼途中",
        '<div style="display:flex;gap:11px;align-items:center;margin-bottom:10px;">' +
          '<div class="p-ava" style="width:42px;height:42px;font-size:20px;background:#7d6a4f;">' + def.ava + '</div>' +
          '<div style="font-size:16px;font-weight:bold;color:var(--txt);">' + def.name +
          ' <span style="font-size:11px;color:#c0564f;">在拖累你</span></div></div>' +
        '<div style="font-size:13px;color:var(--dim2);line-height:1.8;margin:2px 0 13px;">' + line + "<br>" +
        '<span style="color:#c0564f;">大部队没有停——你每犹豫一秒，就离马修更远一分。</span></div>' +
        '<button class="here-btn primary" style="width:100%;" onclick="WK.STORY10._closeRestPrompt()">再坚持一下（拽起他继续下）</button>');
    },
    _closeRestPrompt(silent){
      const p = WK.P;
      if (p && p.flags._restPending && !silent)
        WK.log("sys", "你半拖半架，硬把人从台阶上拽起来：「别停，停在这里就是死！」");
      if (p) p.flags._restPending = false;
      WK.ui.closeOverlay("ov-generic");
      if (p) WK.save.write();
    },

    /* 抵达底层 / 阶段结束：清搀扶临时态（人已救活，死活由 alive 决定，与这些计数无关）*/
    clearAssist(){
      const p = WK.P; if (!p || !p.flags) return;
      p.flags._assistWho = null;
      p.flags._assistFloors = 0;
      p.flags._assistLag = 0;
      p.flags._restPending = false;
    },

    register(){
      const E = WK.EVENTS;

      /* —— 序章：苏醒 + 张杰讲规则（豆包v168：改为主动触发，stage0）——
         玩家在苏醒车厢醒来后不再被强制弹窗：移动被「剧情门控」拦下，张杰人物卡亮「问话」角标，
         点张杰才 EVT.run 拉起本段。读档/误关窗口后，门控由 stage0 自动恢复，仍可点张杰续看，
         不会再出现「人在列车、剧情丢失、卡住走不动」的死局。when 保留仅作文档/调试锚点，manual 禁自动。 */
      E.n10_wake = { once:true, manual:true, when:{ trigger:"stage", stage:0 },
        script:{ id:"n10_wake", lock:true, title:"第一章 · 醒来",
      steps:[
        { narr:"冰冷，抖动……你猛地从地上弹起来，惊慌地看向四周。脑海里的电脑桌、办公室，和眼前的环境瞬间混在一起，几秒后才清醒过来。", fast:true },
        { narr:"这是一节正高速行驶的车厢，顶灯惨白，金属座椅冰凉。你身边横七竖八躺着几个人，车厢另一头，还站着十多名持枪的外国人。", fast:true },
        { narr:"你想起那台办公电脑上弹出的话——「想明白生命的意义吗？想真正的……活着吗？」你在 YES 上点了一下，然后失去了知觉。", fast:true },
        { who:"zhangjie", say:"不错，你是这次来的人里素质最好的一个。" },
        { narr:"说话的是个黑发青年，脸上几道狰狞刀疤，手里夹着根烟。他视线越过你，看向你身后躺着的五个人——三男二女。" },
        { choices:[
          { text:"这里是什么地方？你们是谁？", primary:true },
          { text:"（压下惊慌，先不动声色地观察）" }
        ]},
        { who:"zhangjie", say:"仔细想想，它应该已经把这一切植入你脑海里。" },
        { narr:"你一回想，脑海里果然多了些东西——生存、生命、恐怖片。这是一个「游戏」：把在现实里感到腐朽的人送进一部部恐怖片里挣扎。", fast:true },
        { who:"zhangjie", say:"这一次是生化危机第一部，菜鸟们，你们的运气可真是好啊，第一次进来就遇到这么轻松的恐怖片，即使是死也会死得很轻松才对。" },
        { who:"fatty", say:"你的意思是说，我们意识进了电脑，玩完就能回身体里复活？" },
        { narr:"黑发青年猛地弹起，下一秒已把小胖子压在身下，沙漠之鹰的枪口狠狠塞进他嘴里。" },
        { who:"zhangjie", say:"那你想试试死吗？我经历了三部恐怖片，第一部猛鬼街一，十五个新人，只有我和另外一个活下来——在恐怖片里死，就是真的死。" },
        { narr:"众人忙把两人劝开。他冷笑着重坐回去，继续摩挲那把枪。" },
        { who:"zhanlan", say:"那我们没办法回到自己的身体里了吗？" },
        { who:"zhangjie", say:"你们是连精神带身体一起进来的，回不去了……至少我以为回不去。不过——确实有回去的希望。" },
        { who:"zhangjie", say:"每活过一部恐怖片，得一千点奖励值。它能换在这个世界正常地方生活的天数，能换这把无限子弹的沙漠之鹰（一百点），还能一点换一点，强化你的智力、精神力、细胞活力、神经反应、肌肉强度、免疫力——普通人这六项都是一百。" },
        { who:"zhanlan", say:"那么……回到我们自己的世界，要多少点？" },
        { who:"zhangjie", say:"五万点。一点不用，活过五十部恐怖片，你就能回去。" },
        { choices:[
          { text:"五十部……这怎么可能活得到。" },
          { text:"（记住这个数字：五万。）", do:[["favor","zhangjie",1]] },
          { text:"除了这一千点，还能怎么赚点？" }
        ]},
        { who:"zhangjie", say:"外快也有。给你们解释规则，按主神规定我就有一百点。看看你们左手——" },
        { narr:"众人低头，左手腕上都多了一块样式古朴的黑色纯金属手表。表盘此刻还暗着，没在倒数什么，只静静列着几行数据：丧尸数、爬行者数、新人数……至于「要在这片鬼地方待多久」，它似乎要等一等才肯告诉你。", fast:true },
        { who:"zhangjie", say:"每杀十只丧尸，一点。每杀一只爬行者，一百点。每杀一个新人——奖励一千点。当然，是负的。" },
        { who:"zhengzha", say:"那个「主神」到底是什么？" },
        { who:"zhangjie", say:"管理我们进出恐怖片循环的东西，发奖励点、给兑换，就是一个光团。它究竟是什么，我也不知道。" },
        { who:"zhanlan", say:"最后一个问题……这手表怎么黑着，它到底要我们在这儿待多久？" },
        { who:"zhangjie", say:"急什么。等真正踏进恐怖片的地盘——下到那座蜂房里，它自然会开始倒数：三个小时。时间一到还活着，就能回主神那儿领奖励，再去面对下一部。在那之前，先操心怎么跟紧那个黑人大队吧。" },
        { narr:"你心里一动。你看过《生化危机1》——开场这节车，会停在地下实验室「蜂房」的入口站台；而车上那个黑人，就是雇佣兵队长马修·艾迪森。" },
        { choices:[
          { text:"（开口提醒：等会儿别离开那个黑人队长太远。）", do:[["favor","zhangjie",1],["favor","zhanlan",1],["favor","zhengzha",1]] },
          { text:"（先不说破，继续听。熟知剧情是我最大的底牌。）", primary:true }
        ]},
        { narr:"车厢开始缓缓减速。黑发青年几口吸完烟，掏出沙漠之鹰站了起来。" },
        { who:"zhangjie", say:"好了，剧情从现在开始——他们现在能听见我们说话了。记住，被他们听到讨论主神、奖励点，每句扣十分。菜鸟们，好好活下去吧！" },
        { god:"手表一震，左上角浮起一个名字：马修-艾迪森。离开他 100 米——抹杀。至于存活倒计时，表盘仍暗着：先跟着他，活着下到蜂房底层再说。" },
        { act:[ ["fn","n10AnchorMatthew"] ] },
        { choices:[ { text:"（跟着人群，下车。）", primary:true, do:[["stage",1]] } ] }
      ]}};

      /* —— 站台：蜂房/UMBRELLA/失忆毒气讲解 + 坠毁电梯 → 走楼梯 —— */
      E.n10_platform = { once:true,
        when:{ trigger:"enter", room:"pm_hall", if:p=>p.stage===1 },
        script:{ id:"n10_platform", lock:true, title:"地面站台 · 蜂房入口",
      steps:[
        { narr:"众人下车。站台尽头，一座封闭的钢铁大门横在面前，门上印着保护伞的标志与危险符号。雇佣兵们立刻架起设备开始破解。" },
        { who:"alice", say:"我想知道你们是谁？还有这里究竟发生了什么事？" },
        { who:"matthew", say:"我们受雇于 UMBRELLA 公司——也包括你。这门通往「蜂房」，你是公司登记在册的大门保安，所以我们才带上你。" },
        { who:"alice", say:"那这是什么？" },
        { narr:"她摩挲着手指上的结婚戒指。" },
        { who:"matthew", say:"你并没有结婚，那只是个掩饰，也是你保护蜂房的标志。" },
        { who:"ryan", say:"那什么是蜂房？" },
        { narr:"一名雇佣兵在笔记本上调出画面：地表大楼、进入地底的火车、一座如蜂巢般深埋地下的建筑。" },
        { who:"matthew", say:"蜂房深藏在浣熊市地底，是保护伞的绝密研究机构，里面有五百名科学家和工作人员，研究某些连我们也不清楚的机密。" },
        { who:"alice", say:"那他们呢？" },
        { narr:"她忽然指向了你们这群「保安」。" },
        { who:"matthew", say:"他们也是登记的保安……不过我很怀疑上层的指示，除了那名黄种人是合格的战士，这些人根本就是普通市民。" },
        { who:"ryan", say:"我为什么会失去记忆？什么都想不起来。" },
        { who:"matthew", say:"蜂房遭攻击时，中央电脑会释放一种神经性毒气，让人昏迷四小时，醒后失去记忆，持续一小时到一周不等。" },
        { who:"matt", say:"你的意思是蜂房已经遭到攻击？里面有恐怖分子？" },
        { who:"matthew", say:"……也许，比那还要糟糕。" },
        { narr:"【记忆闪回】你太清楚了：T 病毒被眼前这个叫瑞恩的男人盗出并摔碎，经通风系统传遍蜂房，五百人全部感染成了丧尸，红后才封死了这里。" },
        { narr:"「长官，大门打通了，可以进入。」大门缓缓开启，里面一片漆黑。" },
        { who:"matthew", say:"J-D！……张杰！" },
        { narr:"J-D. 戴上夜视镜率先摸入，张杰提着沙漠之鹰大咧咧跟上，很快灯亮了——墙上的「窗户」外竟是阳光灿烂的城市天际线。" },
        { who:"rain", say:"毒气已经驱散，这里安全了。" },
        { who:"matt", say:"这装置是用来改善地下工作环境的，谁也不想一天到晚只看着钢铁墙壁。" },
        { narr:"另一边，马修等人撬开了电梯门，井里漆黑。一名雇佣兵扭开照明弹丢下去——火光一路坠到最深处，电梯轿厢早已砸成铁饼。" },
        { who:"jd", say:"长官，看来我们要走楼梯了。" },
        { who:"matthew", say:"走楼梯！十分钟之内必须到达底层，所有人跟上！" },
        { choices:[
          { text:"（……十分钟。跟紧，千万别掉队。）", primary:true, do:[["favor","matthew",1]] },
          { text:"（十分钟跑下这么深的楼？要出事。）" }
        ]},
        { act:[ ["log","quest","主线：跟随马修小队，十分钟内下到蜂房底层。"],
                ["fn","n10QuestStairs"], ["stage",2] ] }
      ]}};

      /* —— 50 层下楼：里程碑事件（enter 指定楼层）—— */
      E.n10_s50 = { once:true,
        when:{ trigger:"enter", room:"s_50", if:p=>p.stage===2 },
        script:{ id:"n10_s50", lock:true, title:"下行楼梯井",
        onDone(){ WK.STORY10.startSquad(); },   // 豆包v116：对话结束，马修大部队开始每秒下一层
      steps:[
        { narr:"防火门在身后合拢。楼梯一圈圈旋进地底，黑得望不到底。大部队没有半分停顿，立刻全速向下。" },
        { narr:"戴眼镜的女孩起步就一把揪住张杰的衣角，借力跟跑；张杰只看了她一眼，没说话，带着她冲到了前面。" },
        { who:"zhengzha", say:"（他跑在你身侧）坚持住，跟紧前面的人，别逞能也别停下！" },
        { choices:[ { text:"（咬牙跟上。）", primary:true } ] }
      ]}};

      /* —— 豆包v120：s_42 体力透支点 · 四选一搀扶（只能帮一个；帮人＝下楼变慢，帮小胖/妇女还会反复瘫倒要歇息）—— */
      E.n10_s42 = { once:true,
        when:{ trigger:"enter", room:"s_42", if:p=>p.stage===2 },
        script:{ id:"n10_s42", lock:true, title:"下行途中",
        onDone(){ if (!WK.P.flags._assistWho) WK.STORY10.assistStart("none"); },  // 兜底：理论上四选一必选
      steps:[
        { narr:"大肚的小胖子喘得像破风箱，脚步彻底乱了；那名中年妇女也落到最后，只能一级一级往下挪。戴眼镜的詹岚呼吸急促，明显也快到了极限。" },
        { who:"fatty", say:"等、等等我……跑不动了……腿软……" },
        { who:"woman", say:"呼……呼……等等……别、别丢下我……" },
        { who:"zhangjie", say:"（头也不回，冷冷地）停就是死。想当好人，先掂掂自己几斤几两。" },
        { narr:"你只有一双手，最多拉住一个人——而架着任何人，你都会比独自下楼慢得多。小胖子和中年妇女，更是随时会瘫给你看。" },
        { choices:[
          { text:"（一把架住小胖子的胳膊）撑住，我带你下去！", do:[["fn","assistFatty"]] },
          { text:"（拉住中年妇女的手）大姐，抓紧我，别松手！", do:[["fn","assistWoman"]] },
          { text:"（回头向詹岚伸出手）抓紧我，跟我走！", do:[["fn","assistZhanlan"]] },
          { text:"（咬紧牙，谁也顾不上，埋头自顾自向下冲）", primary:true, do:[["fn","assistNone"]] }
        ]}
      ]}};

      /* 豆包v123：s_33 预告别（在 s_31 那声爆炸之前）。必须按你这一程架着谁动态生成——
         你若一路架着小胖子/中年妇女，那个人此刻就在你胳膊上，不能还说「两个人都不见了、两名出局」。
         没扶他俩（自顾自/扶詹岚）→ 两人都掉队，张杰冷口判两名出局；
         救下其中一个 → 只有另一个消失，张杰判「一名出局」，并点一句你正扛着的这个。*/
      E.n10_s33 = { once:true,
        when:{ trigger:"enter", room:"s_33", if:p=>p.stage===2 },
        script(p){
          const who = p.flags._assistWho;
          const savedFatty = (who === "fatty"), savedWoman = (who === "woman");
          const steps = [];
          if (savedFatty) {
            steps.push({ narr:"又往下跑了好一阵，那名中年妇女的身影已经彻底看不见了。小胖子还被你半拖半架地拽在身侧，沉得像袋泡了水的米，每下一级都在你耳边喘。" });
            steps.push({ who:"zhengzha", say:"那个大姐呢？她怎么没跟上来？……还好，小胖子还在你这边。" });
            steps.push({ who:"zhangjie", say:"一名出局。" });
            steps.push({ who:"zhengzha", say:"什么……一名出局？" });
            steps.push({ who:"zhangjie", say:"离开马修一百米就会爆炸，这是规则。那个女人，死定了。（斜眼瞥了下你死死架着的胖子）至于这坨肉——你要真能扛到楼底，算你本事。" });
            steps.push({ choices:[ { text:"（没工夫接话，只把胳膊上的人又往上托了托，继续往下。）", primary:true, do:[["favor","fatty",1]] } ] });
          } else if (savedWoman) {
            steps.push({ narr:"又往下跑了好一阵，小胖子的身影已经彻底看不见了。那名中年妇女被你死死拽着，一步一晃，全靠你撑着才没瘫在台阶上。" });
            steps.push({ who:"zhengzha", say:"小胖子呢？他怎么没跟上来？……大姐你这儿还撑得住吗？" });
            steps.push({ who:"zhangjie", say:"一名出局。" });
            steps.push({ who:"zhengzha", say:"什么……一名出局？" });
            steps.push({ who:"zhangjie", say:"离开马修一百米就会爆炸，这是规则。那个胖子，死定了。（扫了眼你拽着的妇女）心软救一个可以，别指望我会停下来等你们。" });
            steps.push({ choices:[ { text:"（咬紧牙，把人往自己这边又带紧了些，埋头继续下。）", primary:true, do:[["favor","woman",1]] } ] });
          } else {
            // 自顾自 / 扶詹岚：小胖子和中年妇女都没被你拉住，双双掉队
            steps.push({ narr:"又往下跑了好一阵，小胖子和中年妇女的身影已经彻底看不见了。" });
            steps.push({ who:"zhengzha", say:"那两个人呢？他们怎么没跟上来？" });
            steps.push({ who:"zhangjie", say:"两名出局。" });
            steps.push({ who:"zhengzha", say:"什么两名出局？" });
            steps.push({ who:"zhangjie", say:"离开马修一百米就会爆炸，这是规则。你别把我的话当耳风——他们，死定了。" });
            steps.push({ choices:[ { text:"（后背一阵发凉，脚下不敢再有半分停顿。）", primary:true } ] });
          }
          return { id:"n10_s33", lock:false, title:"下行途中", steps:steps };
        }
      };

      /* 豆包v120：s_31 锚点抹杀。四选一里没被你拉住的那个人在此炸杀；被你一路架下来的存活。
         script 用函数按 _assistWho 动态生成（最多只能救一个，故死者至少一人）。*/
      E.n10_s31 = { once:true,
        when:{ trigger:"enter", room:"s_31", if:p=>p.stage===2 },
        script(p){
          const who = p.flags._assistWho;
          const savedFatty = (who === "fatty"), savedWoman = (who === "woman");
          const dead = [];
          if (!savedFatty) dead.push("fatty");
          if (!savedWoman) dead.push("woman");
          const names = dead.map(id => "「" + WK.NPCS[id].name + "」").join("");
          const steps = [];
          steps.push({ god: dead.length === 2 ? "轰——！轰——！" : "轰——！" });
          if (dead.length === 2) {
            steps.push({ narr:"楼梯上方接连传来两声剧烈爆炸。你猛地抬头，除了头顶一圈圈的楼梯什么也看不见。雇佣兵和男女主角仿佛根本没听见，人数少了两个，他们也毫无察觉。" });
            steps.push({ who:"zhangjie", say:"看见了吗？这就是真实的世界。人的命，就值刚才那两声响。" });
          } else {
            steps.push({ narr:"楼梯上方只传来一声沉闷的爆炸。你架着的人猛地一颤，几乎瘫在你身上——这一次，消失的只是另一个没人拉住的身影。" });
            steps.push({ who:"zhangjie", say:"（回头瞥了眼你死死架着的人，语气里头一回掺了点别的东西）……硬撑着带下来一个？哼，别高兴太早，到底之前你一松手，他照样是那一响。" });
            if (savedFatty)
              steps.push({ who:"fatty", say:"（脸惨白如纸，整个人挂在你胳膊上）那、那位大姐……她方才还在我后头喘着……就一声……" });
            else
              steps.push({ who:"woman", say:"（捂着嘴，眼泪和汗一道往下淌，却被你拖着半步不敢停）小、小胖子他……方才那一声响……是他吧……" });
            steps.push({ narr:"你容不得他哭，半拖半架着继续往下。多带一个人，你的体力也在飞快见底，可你知道，自己已经把一条命从主神手心里抠了出来。" });
          }
          steps.push({ god:"【主神】轮回者" + names + "脱离锚点人物 100 米，已抹杀。" });
          steps.push({ act: dead.map(id => ["die", id,
            WK.NPCS[id].name + "在下行楼梯上掉队，脱离马修一百米，被主神炸杀。"]) });
          steps.push({ choices:[ { text: dead.length === 2 ? "……我不想死。继续下！" : "（抓紧手里的人）走，别停！",
                                  primary:true, do:[["favor","zhangjie",1]] } ] });
          return { id:"n10_s31", lock:true, title:"轰响", steps:steps };
        }
      };

      E.n10_s15 = { once:true,
        when:{ trigger:"enter", room:"s_15", if:p=>p.stage===2 },
        script:{ id:"n10_s15", lock:false, title:"火焰女皇",
      steps:[
        { who:"jd", say:"长官，火焰女皇已经锁定我们，它知道我们在这里了。" },
        { who:"alice", say:"火焰女皇是谁？" },
        { who:"matthew", say:"国内最好的人工智能系统，掌控整个蜂房，是这里的中央主电脑。" },
        { who:"zhangjie", say:"（回头嗤笑）能活下来就谢天谢地吧。这是少数靠子弹就能解决问题的恐怖片——只要活过这一场，你们就有一千点改善体质了。" },
        { choices:[ { text:"（扶着扶手，机械地迈腿，不敢停。）", primary:true } ] }
      ]}};

      E.n10_bottom = { once:true,
        when:{ trigger:"enter", room:"s_bottom", if:p=>p.stage===2 },
        script:{ id:"n10_bottom", lock:true, title:"底层大厅",
      steps:[
        { narr:"漫长的楼梯终于到了尽头。你几乎是跌进底层大厅的，双腿抖得不像自己的。" },
        { narr:"眼前灯火通明，整面墙都是透明玻璃，玻璃后注满淡绿色的培养液，一些穿着研究服的人影静静悬浮在里面——白森森的，一动不动。" },
        { narr:"【记忆闪回】他们已经中了 T 病毒。一旦中央电脑被关闭，这些「浮尸」就会挣脱束缚，开始吃人。" },
        { who:"matthew", say:"全体戒备，继续深入。" },
        { god:"就在你双脚落进底层大厅的刹那，腕上的手表「嗡」地亮起，幽蓝数字开始跳动——三小时存活倒计时，此刻才正式开始。任务栏里也多出了一条：在蜂房，活到时间结束。" },
        { act:[ ["log","quest","你活着下到了蜂房底层。"],
                ["fn","n10QuestStairsDone"], ["fn","n10StartSurvival"], ["stage",3] ] },
        { choices:[ { text:"（喘着气，跟上队伍走进实验区。）", primary:true } ] }
      ]}};
    }
  };

  // 注册剧情事件
  WK.STORY10.register();

  /* 豆包N10：复杂剧情动作（fn 原语调用）——集中放 fnLib，便于 N11/12 续写 */
  Object.assign(WK.EVT.fnLib, {
    n10AnchorMatthew(){
      // 豆包v124：列车上只锁定马修锚点（100 米抹杀）；三小时存活倒计时与时间任务
      // 改为下到蜂房底层（n10StartSurvival）才启动，下楼段不再提前挂时间任务。
      WK.rules.setAnchor("马修-艾迪森");
    },
    n10QuestStairs(){
      WK.quest.add({ id:"q_stairs", type:"main", title:"跟随马修小队，十分钟内下到蜂房底层", state:"active" });
    },
    n10QuestStairsDone(){
      WK.quest.setState("q_stairs", "done");
      // 豆包v120：下到底层，搀扶环节结束（被救者的死活只看 alive；清临时计数）
      if (WK.STORY10) WK.STORY10.clearAssist();
    },
    /* 豆包v124：下到蜂房底层，三小时存活倒计时此刻才真正开始（同时挂存活主线任务）。
       列车/站台/下楼阶段手表保持暗着，只盯马修锚点距离。*/
    n10StartSurvival(){
      if (!WK.P.watch.running && !WK.P.watch.ended) WK.rules.startWatch();
    },

    /* —— 豆包v120：s_42 四选一搀扶（once 事件，只会有一个被调用）—— */
    assistFatty(){ WK.STORY10.assistStart("fatty"); },
    assistWoman(){ WK.STORY10.assistStart("woman"); },
    assistZhanlan(){ WK.STORY10.assistStart("zhanlan"); },
    assistNone(){ WK.STORY10.assistStart("none"); }
  });

  /* ============================================================
   * 豆包N11：正式剧情 · 第一集中段
   * ------------------------------------------------------------
   * 对齐原著第二章（下）—第三章：注水研究间浮尸与四人自我介绍、
   * B 餐厅封冻爬行者集装箱与詹岚「能否改剧情」之问、操纵室卡普兰破防、
   * 激光通道（牟钢被击毙 / 郑吒精神临界突破救马修 / B级支线5000点）、
   * 关闭红后、雷恩被咬、丧尸潮退守主机房。
   *
   * 玩家（看过电影的第八人）在激光通道前二选一：
   *   · 留在外（canonical，安全）：可在第一道激光前「喊提示」（先知小支线）；
   *   · 跟进去（flag laserInside）：三道激光限时 QTE，全对＝高额点数+改剧情标记，
   *     错一道＝重伤剩 20 血被拖出，错两道＝被激光杀死（rules.erase 真抹杀）。
   * 关红后即置 flags.redqueenOff，N5 丧尸刷怪门控由此打开（自由探索也开始有怪）。
   * 结束清掉马修锚点（原著：手表上他名字消失，可自由行动），A/B 分线留给 N12。
   * ============================================================ */
  WK.STORY11 = {
    register(){
      const E = WK.EVENTS;

      /* ===== stage3：注水研究间 · 浮尸 + 四人自我介绍 + 改走 B 餐厅 ===== */
      E.n11_lab = { once:true,
        when:{ trigger:"enter", room:"l_hall", if:p=>p.stage===3 },
        /* 豆包v120：script 改函数。小胖子/中年妇女在 s_31 被救活（alive 仍为真）时，
           才会在这场自我介绍里报上真名与来历；没救成则按原著两人缺席（stage3 applyStage 也不摆他们）。*/
        script(p){
      const steps=[
        { narr:"走廊两侧的研究间全被注满了水，许多研究员的尸体白森森地浮在里面。你知道，他们早已中了 T 病毒——红后一重开，这些浮尸就会起身吃人。" },
        { who:"matthew", say:"要到火焰女皇那里，这些实验室是必经通道，现在全被水淹没了。雷恩、J.D.，去看看还能不能排水。卡普兰、张杰，你们去找另一条路。" },
        { narr:"四人分头探路。马修这才向余下的人说明：五小时前火焰女皇封死蜂房、放毒气、杀人——公司派这支小队来，就是为了关掉它。" },
        { narr:"马特背靠的玻璃墙后，缓缓浮出一具苍白的女尸。他吓得大叫着跳开，你也后背发凉——坐屏幕前看不觉得，身临其境，那种阴森根本说不出口。" },
        { who:"zhanlan", say:"（拍了你肩一下，自己先笑了）喂，我们互相介绍一下吧，马上就要相依为命了。我叫詹岚，作家——来之前还在抱怨没写作灵感，这下可算到了无限灵感的世界。" },
        { who:"zhengzha", say:"郑吒，公司主管。来之前也嫌日子平淡得像在一天天腐烂……只不过这儿的刺激，实在太强烈了。" },
        { who:"mougang", say:"俺叫牟钢，长途货运司机，比不得你们文化人。在家跟伙计玩游戏点了个确认，就跑这儿来了。" },
        { who:"lixiaoyi", say:"李萧毅，高三。只要不死就能变强，回去我再不受人欺负。" }
      ];
      const alive = id => !!(p.npcs[id] && p.npcs[id].alive !== false);
      if (alive("fatty")) {
        p.flags.revealNameFatty = true;   // 豆包v122：此刻他亲口报上真名，此后界面才显示「庞大海」
        steps.push({ who:"fatty",
          say:"（这会儿总算缓过一口气，他挠着后脑勺有点不好意思）我叫庞大海，二十八，在家帮爹妈守小卖部。发小都喊我『胖大海』——又胖又虚，跟那泡水就发胀的胖大海一个德行。我平素最大的运动量，是从沙发挪到冰箱，这下可把半辈子的路一口气跑完了。" });
        steps.push({ who:"fatty", say:"（声音忽然低下去，冲你憨笑）别的没有，往后你让我往东，我庞大海绝不往西——下楼梯那一把，我记一辈子。" });
      }
      if (alive("woman")) {
        p.flags.revealNameWoman = true;   // 豆包v122：此刻她亲口报上真名，此后界面才显示「李秀兰」
        steps.push({ who:"woman",
          say:"（她搓着一双粗糙的手，声音还打着颤）我叫李秀兰，四十六，在县城超市理货。男人在外头打工，家里就一个上初中的娃……还等着我回去给他做晚饭呢。" });
        steps.push({ who:"woman", say:"（抹了把脸上的汗和泪）我啥本事也没有，下楼梯要不是你拽着，这条命就交代在那儿了。拜托你们了，多、多照应着点。" });
      }
      steps.push({ choices:[
          { text:"我叫{name}，我也是被那个「YES」坑进来的。", primary:true, do:[["favor","zhanlan",1],["favor","zhengzha",1]] },
          { text:"（点头示意，没有多说。）" }
        ]});
      // 豆包v118：到此事件结束 → onDone 进入等待态；探路归来改由 n11_lab_back 承接
      return { id:"n11_lab", lock:true, title:"注水研究区",
        onDone(){ if (WK.STORY11.searchStart) WK.STORY11.searchStart(); },
        steps:steps };
        }
      };

      /* ===== stage3：四人探路期间的「原地等待」归来剧情（仅由 STORY11.waitHere 显式 run）===== */
      E.n11_lab_back = { once:true,
        script:{ id:"n11_lab_back", lock:true, title:"探路归来",
      steps:[
        { narr:"也不知等了多久，通道里终于传来脚步声——张杰和探路的人回来了。他故意在詹岚屁股上重重一拍，惹得她一声尖叫，自己却哈哈笑着走向马修。" },
        { who:"kaplan", say:"长官，找到另一条路，但要多花一倍时间：先退回这里，穿过 B 餐厅，再直达目的地。" },
        { who:"rain", say:"那边彻底被淹没了，走不过去。" },
        { who:"matthew", say:"好，走第二条路。时间不多了，大家快走。" },
        { act:[ ["log","quest","随大部队改道，穿过 B 餐厅前往操纵室。"], ["stage",4] ] },
        { choices:[ { text:"（跟上队伍，折回走向 B 餐厅。）", primary:true } ] }
      ]}};

      /* ===== stage4：B 餐厅 · 封冻爬行者集装箱 + 改剧情之问 ===== */
      E.n11_dining = { once:true,
        when:{ trigger:"enter", room:"d_floor", if:p=>p.stage===4 },
        script:{ id:"n11_dining", lock:true, title:"B 餐厅 · 集装箱阵列",
      steps:[
        { narr:"铁门后是一片摆着无数小型集装箱的广阔大厅，箱体约数米立方，门上一排排绿色指示灯，透着森冷的气息。你后背一紧——这里封冻的全是爬行者，比丧尸强百倍。" },
        { who:"jd", say:"地图上……这里是 B 餐厅。" },
        { who:"matt", say:"也许这里藏着些公司不想让外界知道的秘密。" },
        { who:"matthew", say:"J.D.、雷恩、张杰，看住犯人和出口；毒气显示为零，可能有幸存者，搜索一下，但别走太远。" },
        { who:"zhanlan", say:"（凑到张杰身边，压着嗓子）我想知道一件事——我们能改变电影剧情吗？比如……用塑胶炸弹把这一屋子爬行者全炸了，是不是能拿数千点？" },
        { who:"zhangjie", say:"话是没错。可第一，他们会给你时间摆炸弹吗？（他瞟向雇佣兵）我们做出他们看不懂的事，最大的可能是被先开枪，反倒提前放出爬行者。" },
        { who:"zhangjie", say:"第二，强改剧情，「主神」很可能顺手把难度和意外一起抬高。在恐怖片里能活命的最大凭依是什么？是熟知剧情。没有绝对把握，我绝不改剧情；谁想硬改来刷点，我不介意送他下地狱。" },
        { choices:[
          { text:"（记住：熟知剧情＝最大的底牌，别浪。）", primary:true, do:[["favor","zhangjie",1]] },
          { text:"（可要是能救下本该死的人呢……）" }
        ]},
        { narr:"你注意到，张杰说这话时，却用一种怜悯又嘲弄、像在看死人的目光，看了郑吒一眼。你隐隐不安——他像是知道接下来谁会忍不住。" },
        { who:"matthew", say:"好，开始行动，剩下的人跟我来！" },
        { act:[ ["log","quest","跟随马修前往中央电脑操纵室。"], ["stage",5] ] },
        { choices:[ { text:"（跟着队伍穿过安全门。）", primary:true } ] }
      ]}};

      /* ===== stage5：操纵室 · 破防 + 郑吒喊警告 + 牟钢之死 + 进/留激光通道抉择 ===== */
      E.n11_control = { once:true,
        when:{ trigger:"enter", room:"c_room", if:p=>p.stage===5 },
        script:{ id:"n11_control", lock:true, title:"中央电脑操纵室",
      steps:[
        { narr:"卡普兰直接打开三具手提电脑，双手在键盘上翻飞。数分钟过去，通往中央电脑的大门仍死死闭着。" },
        { who:"rain", say:"怎么会花那么多时间？" },
        { who:"kaplan", say:"火焰女皇的防御系统十分完备，能轻易突破，它也不配当实验室主电脑了……" },
        { narr:"一声轻响，大门缓缓开启。马修回头看向你们。" },
        { who:"matthew", say:"把东西装起来！……你们，留在这里。" },
        { narr:"门后是一条十多米长的通道，两侧却是通顶的玻璃墙，和外面的钢铁墙壁完全不同。马修谨慎地走到通道中央，玻璃墙猛地一齐亮起。" },
        { who:"kaplan", say:"（对讲机）放心，只是自动感应灯，没什么可担心的。" },
        { narr:"【记忆闪回】你心里一沉——那根本不是感应灯，是自动防御系统的激光线。等会儿，这里会变成一台绞肉机。" },
        { narr:"马修放好传输器，通往中央电脑的第二道门缓缓开启。卡普兰说，这装置能放出强电流搞乱主机、让火焰女皇重启。" },
        { who:"zhengzha", say:"等、等等！你们不觉得古怪吗？这电脑未免太没用了，就这么让你们重启——这通道里很可能有什么奇特的地方！" },
        { narr:"雇佣兵们全停下，古怪地看着郑吒。詹岚暗叹一声，松开了原本想拉住他的手，默默退到艾丽丝身边。" },
        { who:"matthew", say:"（走回来，盯着郑吒和牟钢）那好——你，还有你，也跟着我们一起进来。" },
        { choices:[
          { text:"我也进去。多个人提醒，兴许能多救一个。（高危）", do:[["flag","laserInside"],["favor","zhengzha",2],["favor","matthew",1]] },
          { text:"我留在外面接应。（与詹岚、李萧毅一起，稳妥）", primary:true, do:[["flag","laserOutside"]] }
        ]},
        { who:"mougang", say:"不、我不要！我不要进去啊——！" },
        { narr:"牟钢抱头大叫，转身向来路狂奔。郑吒几人还没反应过来，雇佣兵已经举枪——枪声炸响，他被整个人击飞出去，落地时已成了一具浑身弹孔的尸体。" },
        { god:"【主神】轮回者「牟钢」试图逃离激光通道，被雇佣兵击毙。" },
        { act:[ ["die","mougang","牟钢在激光通道前精神崩溃、转身逃跑，被雇佣兵当场击毙。"],
                ["log","danger","一条命就这么没了。在这儿，慌乱和违令都是死。"] ] },
        { who:"matthew", say:"我早怀疑你们不是普通保安。郑吒，还有要进来的那位——走。" },
        { act:[ ["stage",6] ] },
        { choices:[ { text:"（跟着走向那条雪白的死亡通道。）", primary:true } ] }
      ]}};

      /* ===== stage6：激光通道 —— 按「进 / 留」分两套剧本 ===== */
      E.n11_laser = { once:true,
        when:{ trigger:"enter", room:"c_laserin", if:p=>p.stage===6 },
        script:function(P){
          const inside = !!P.flags.laserInside;
          const commonTail = [
            { who:"lixiaoyi", say:"（冲过来）你、你们太棒了！那种情况居然能活下来！" },
            { who:"zhanlan", say:"（眼里有泪，却仍板着脸）早提醒过你们别改剧情。我们最大的凭依不是运气，是熟知剧情——以后千万别再这么冲动。" },
            { narr:"马修·艾迪森，这个本该在通道里被切成碎块的雇佣兵队长，活了下来。你清楚，剧情已经偏离了原著。" },
            { act:[ ["log","quest","激光通道生还。剧情已经偏移，主神的「补偿」或许正在路上。"], ["stage",7] ] },
            { choices:[ { text:"（随马修、艾丽丝走向火焰女皇的主机房。）", primary:true } ] }
          ];
          if (!inside) {
            return { id:"n11_laser", lock:true, title:"激光通道（在外接应）", steps:[
              { narr:"你和詹岚、李萧毅站在钢铁大门的玻璃口外。大门在马修等人进入后轰然合拢，通道里只剩惨白的灯。" },
              { narr:"正对面玻璃墙的光芒猛地一暗，一条激光细线凭空成形，贴着头部高度疾速划向通道中央的人！" },
              { choices:[
                { text:"（失声大喊）卧倒——！都趴下！", primary:true, do:[["favor","zhengzha",2],["favor","matthew",1],["flag","laserShouted"]] },
                { text:"（死死捂住嘴，不敢出声干扰他们。）", do:[["favor","zhanlan",1]] }
              ]},
              { narr:"马修反应最快，一把扑倒身边两人；郑吒一直盯着激光，出现的同时已经卧倒，白线堪堪擦着他肩膀掠过。" },
              { narr:"那名女医务兵却慢了半步——她的头缓缓滑落，直直掉在地上，那双死瞪的眼睛像种嘲弄。" },
              { narr:"第二道激光在腿部高度成形。郑吒死死盯着一名雇佣兵：在对方跳起的刹那，他猛地卧倒——激光恰在此时划高，把跳起的雇佣兵当场分尸。" },
              { god:"精神临界值突破！奖励点数 500 点，精神力 +20，神经反应速度 +30！" },
              { narr:"第三道拦腰的激光疾速而来。所有人都想卧倒，郑吒却死死拖住马修，把他和自己一起紧贴在入口大门上，闭眼不躲。" },
              { narr:"白线在离两人鼻尖数厘米处骤然张开成网，又一点点黯淡、熄灭。马修只来得及骂出一声，便僵在原地不敢相信自己还活着。" },
              { who:"zhengzha", say:"（从马修衣领上拈起一个小光球，它在指间化开）这是……" },
              { god:"B 级恐怖支线剧情完成！奖励点数 5000 点！" },
              { narr:"郑吒怔在原地，两道生死关在一瞬间走完。你站在门外，后背的冷汗早已浸透了衣服。" }
            ].concat(commonTail) };
          }
          return { id:"n11_laser", lock:true, title:"激光通道（身在其中）", steps:[
            { narr:"你跟在马修和郑吒身后走了进去。身后钢铁大门轰然合拢——没有退路了。玻璃墙白线一闪，第一道激光正贴着头部高度，朝你们划来！" },
            { act:[ ["fn","n11QteLaunch"] ] },
            { narr:"（你大口喘着气，通道里的白线一条条熄灭，大门重新开启。）" }
          ].concat(commonTail) };
        }
      };

      /* ===== stage7：关闭红后 → 雷恩被咬 → 丧尸潮退守 ===== */
      E.n11_shutdown = { once:true,
        when:{ trigger:"enter", room:"core_room", if:p=>p.stage===7 },
        script:{ id:"n11_shutdown", lock:true, title:"主机房 · 关闭火焰女皇",
      steps:[
        { narr:"马修和艾丽丝走进火焰女皇的核心机房，将重启装置接上主机。整个房间的灯光猛地一黯。" },
        { who:"zhanlan", say:"（低声、极快）记住：别离开张杰，别被咬到或抓到。电影里感染后约三十分钟变丧尸，十分钟内打解毒剂才有效——而解毒剂在车厢那头。还有，打头。" },
        { god:"火焰女皇已关闭。隔离系统失效——蜂房里的东西，醒了。" },
        { act:[ ["flag","redqueenOff"], ["log","danger","红后关闭，全蜂房的丧尸与爬行者挣脱了封锁。"] ] },
        { narr:"B 餐厅方向骤然传来枪声。众人冲到走廊，只见雷恩捂着手怒骂——她拇指与食指间被咬去一大块肉，鲜血淋漓。" },
        { who:"rain", say:"我们发现一个「幸存者」，可他疯了，竟然咬我！我开了枪……他却不见了，地上只剩一滩半干的血。" },
        { who:"matthew", say:"（脸色铁青）我们马上离开蜂房！已经没有什么后续部队了——准备撤离！" },
        { narr:"走廊尽头传来钢铁拖地的刺耳声。一名穿研究服、拖着铁锤的男人摇摇晃晃地走出来，身后跟着越来越多灰白的「人」。" },
        { who:"jd", say:"站住！不然开枪了！" },
        { narr:"他们当然不会停。马修第一个开火，铁锤丧尸中了十几枪仍在站起；张杰抬手就是一枪，沙漠之鹰把它的脑袋打得像西瓜一样爆开。" },
        { who:"matthew", say:"（扔给郑吒一把手枪、两个弹夹）一个弹夹十五发，照张杰那样，专打头！其余人保持队形，退回主机房！" },
        { choices:[ { text:"（握紧拳头——正面迎上第一群丧尸！）", primary:true } ] },
        { act:[ ["goto","core_door"],
                ["battle",{ room:"core_door", title:"退守主机房 · 丧尸潮", noFlee:false,
                  wave:[ {id:"zombie",count:8}, {id:"zombie_sci",count:2} ],
                  allies:[
                    { id:"zhengzha", name:"郑吒", atk:18, hit:0.10, crit:0.12, line:"郑吒抬手枪响" },
                    { id:"zhanlan",  name:"詹岚", atk:9,  hit:0.15, crit:0.05, line:"詹岚冷静地报出方位，随即补了一枪" },
                    { id:"zhangjie", name:"张杰", atk:30, hit:0.30, crit:0.30, line:"张杰的沙漠之鹰轰然爆头" }
                  ] } ] ] },
        { narr:"你们且战且退，在主机房大门合拢的最后一刻冲了进去，外面顿时拍满了密密麻麻的尸手。" },
        { narr:"急促的敲门声响起，艾丽丝和马特从门缝里挤进来，张杰回身几枪打断尸手，轰地把门关上。卡普兰抱头：主机房里没有第二条通道……" },
        { who:"matthew", say:"我们的命令是带回主板、封死蜂房。大楼与蜂房之间的通道，三小时内不撤回就会整个封死。" },
        { narr:"你和张杰对视一眼——都明白了手表三小时倒数的真正含义。" },
        { who:"zhangjie", say:"（盯着手表，忽然嗤笑）好好看看，手表上还有马修·艾迪森的名字吗？" },
        { narr:"詹岚和郑吒同时低头：那个名字，已经消失了。" },
        { who:"zhangjie", say:"从现在起，可以自由行动了——只要能活下去，什么都能做。是跟大部队钻下水道撤，还是守在这最安全的主机房，你们自己选。" },
        { act:[ ["fn","n11ClearAnchor"],
                ["log","quest","锚点解除。下一步：跟随撤离（B线）或留守主机房（A线）——N12 抉择。"] ] },
        { choices:[ { text:"（心脏狂跳。该跟走，还是该留下？）", primary:true } ] }
      ],
      /* 豆包N12：关门·丧尸潮播完后，确定性唤起 A/B 抉择（与本事件同帧 enter 也不竞争）*/
      onDone(p){
        p.flags.shutdownDone=true;
        if (!p.flags.routeChosen && WK.EVENTS.n12_choice) WK.EVT.run("n12_choice");
      }
    }};
    }
  };
  WK.STORY11.register();

  /* ============================================================
   * 豆包v118：注水研究区「四人探路 · 原地等待」环节
   * ------------------------------------------------------------
   * n11_lab（自我介绍）onDone → searchStart()：
   *   置 flags.labSearchWait，把去排水/找路的四人移出当前房（在场列表搭不到他们）。
   * 等待期间：玩家被锁在 l_hall 不能离开（goDir 拦截，提示「还是在原地先等待吧。」），
   *   但可与留在原地的人逐个「搭话」（v117 的分阶段台词）。
   * 点场景按钮「原地等待」→ waitHere() → searchEnd()：四人归队、解锁、播 n11_lab_back。
   * ============================================================ */
  Object.assign(WK.STORY11, {
    WAIT_ROOM: "l_hall",
    // 去探路的四人：雷恩/J.D. 看排水（研究间办公室方向），卡普兰/张杰 找另一条路（B 餐厅方向）
    SCOUTS: { rain:"l_office", jd:"l_office", kaplan:"d_entry", zhangjie:"d_entry" },

    searchStart(){
      const p = WK.P; if (!p) return;
      p.flags.labSearchWait = true;
      // 豆包v119：自我介绍、确认「相依为命」后，郑吒/詹岚才可被邀请入队（开局不可拉）
      p.flags.allyUnlocked = true;
      Object.keys(this.SCOUTS).forEach(id => {
        const n = p.npcs[id], target = this.SCOUTS[id];
        if (n && n.alive !== false && WK.ROOMS[target]) n.loc = target;
      });
      WK.save.write(); WK.renderScene();
    },

    waitHere(){
      const p = WK.P; if (!p) return;
      if (!p.flags.labSearchWait) return;
      if (WK.EVT && WK.EVT.cur && WK.EVT.cur.active && WK.EVT.cur.lock) return;  // 剧情中忽略
      p.flags.labSearchWait = false;
      // 探路四人归队
      Object.keys(this.SCOUTS).forEach(id => {
        const n = p.npcs[id];
        if (n && n.alive !== false) n.loc = this.WAIT_ROOM;
      });
      WK.save.write(); WK.renderScene();
      if (WK.EVENTS.n11_lab_back) WK.EVT.run("n11_lab_back");
    },

    /* 场景按钮：等待中在当前房渲染提示与「原地等待」按钮。
       豆包v127：改挂到九宫格下方、人物列表上方的置顶横幅 #wait-banner，显眼且不会被人物卡片淹没；
       非等待状态主动清空横幅。后续更多「整队 / 原地等候」类节点也统一写入这里。*/
    renderWaitEntry(){
      const p = WK.P, el = document.getElementById("wait-banner");
      if (!el) return;
      if (!p || !p.flags.labSearchWait || p.location !== this.WAIT_ROOM) { el.innerHTML = ""; return; }
      el.innerHTML =
        '<div style="margin-top:12px;border:1px solid var(--gold);border-radius:12px;padding:13px 14px;background:rgba(216,177,90,.07);">' +
          '<div style="font-size:13px;color:var(--gold);font-weight:bold;margin-bottom:6px;">搜寻通路中……</div>' +
          '<div style="font-size:13px;color:var(--dim2);line-height:1.7;margin-bottom:11px;">' +
          '雷恩、J.D. 去查看排水，卡普兰和张杰去找另一条路。先别离开队伍——可以和留在原地的人搭话，等他们回来。</div>' +
          '<button class="here-btn primary" style="width:100%;" onclick="WK.STORY11.waitHere()">原地等待（等他们回来）</button>' +
        '</div>';
    }
  });

  /* ===== 激光通道三道 QTE（高危分支专用）===== */
  WK.STORY11._qte = {
    active:false, round:0, ok:0, timer:null, deadline:0,
    ROUNDS:[
      { q:"第一道激光贴着【头部高度】疾速划来，白线已到眼前——",
        opts:["原地跳起来越过白线","立刻整个人卧倒贴地","转身往回跑"], ans:1 },
      { q:"第二道激光在【腿部高度】成形。一名雇佣兵正要跳起，你记得电影里激光会在他跳起瞬间划高——",
        opts:["跟着他一起跳起躲避","冲上去把他拽倒","盯住他，在他起跳的一瞬原地卧倒、绝不跟跳"], ans:2 },
      { q:"第三道激光【拦腰】而来，近大门处。电影里它会在最后一刻变网——",
        opts:["立刻卧倒滚开","死死贴住入口大门站住、绝不卧倒，闭眼等它变网","朝通道中央冲刺闪避"], ans:1 }
    ],
    PER:5000,
    start(){
      this.active=true; this.round=0; this.ok=0; this.dead=false;
      const c=WK.EVT.cur; if(c) c.suspended=true;
      WK.ui.closeOverlay("ov-dialog");
      this.ask();
    },
    ask(){
      const r=this.ROUNDS[this.round];
      const btns=r.opts.map((o,i)=>
        '<button class="here-btn" style="width:100%;text-align:left;margin-top:9px;" onclick="WK.STORY11._qte.pick('+i+')">'+o+'</button>').join("");
      WK.ui.generic("激光通道 · 第"+(this.round+1)+"/3 道",
        '<div style="color:var(--danger,#c66);font-size:13px;line-height:1.7;margin-bottom:8px;">'+r.q+'</div>'+
        '<div style="background:#222b27;border-radius:4px;height:6px;overflow:hidden;margin-bottom:6px;"><div id="qte-bar" style="height:100%;width:100%;background:linear-gradient(90deg,#e8c860,#c66);"></div></div>'+
        '<div style="color:var(--dim2);font-size:11px;">限时 5 秒，超时算选错。已答对 '+this.ok+'/'+this.round+'。</div>'+btns);
      this.deadline=Date.now()+this.PER;
      if(this.timer) clearInterval(this.timer);
      this.timer=setInterval(()=>{
        const left=Math.max(0,this.deadline-Date.now());
        const bar=document.getElementById("qte-bar"); if(bar) bar.style.width=(left/this.PER*100)+"%";
        if(left<=0){ clearInterval(this.timer); this.pick(-1); }
      },80);
    },
    pick(i){
      if(!this.active) return;
      if(this.timer){ clearInterval(this.timer); this.timer=null; }
      const r=this.ROUNDS[this.round];
      if(i===r.ans) this.ok++;
      this.round++;
      if(this.round<this.ROUNDS.length){ this.ask(); return; }
      this.finish();
    },
    finish(){
      this.active=false;
      const err=this.ROUNDS.length-this.ok, p=WK.P;
      let title, body;
      if(err===0){
        title="激光通道 · 死里逃生";
        WK.rules.addPoints(1500,"激光通道三道激光全部正确躲避（协助改变剧情）");
        p.attrs.spi+=10; p.attrs.ner+=20;
        p.stats.plotChanged=(p.stats.plotChanged||0)+1;
        p.flags._qteResult="good";
        WK.quest.setState("q_laser","done",true);
        body='<div style="line-height:1.8;color:var(--txt);">你像郑吒一样读懂了每一道激光：伏地、盯人、贴门。白线三现三灭，你活着——还拖了马修一把。</div>'+
          '<div style="color:var(--god,#e8c860);margin-top:10px;">奖励点数 +1500，精神力 +10，神经反应速度 +20。</div>'+
          '<div style="color:var(--dim);font-size:12px;margin-top:8px;">你强行介入了原著生死关，剧情偏移已记录——主神的难度补偿，迟早会来。</div>';
      } else if(err===1){
        title="激光通道 · 重伤";
        p.hp=20; p.flags._qteResult="hurt";
        WK.save.write();
        body='<div style="line-height:1.8;color:var(--txt);">一道激光擦过你的身体，炽热的剧痛里你被张杰一把拽回大门边。命保住了，人也几乎散架（生命降到 20）。</div>'+
          '<div style="color:var(--danger,#c66);margin-top:8px;">答错一道：重伤，无奖励。接下来别再硬扛。</div>';
      } else {
        title="激光通道 · 死亡";
        p.flags._qteResult="dead";
        body='<div style="line-height:1.8;color:var(--danger,#c66);">白线没有再给你机会。你的意识在剧痛里被切成无数片——在恐怖片里死，就是真的死。</div>';
        WK.ui.generic(title, body+'<button class="here-btn danger" style="width:100%;margin-top:14px;" onclick="WK.STORY11._qte.die()">……</button>');
        return;
      }
      WK.ui.generic(title, body+'<button class="here-btn primary" style="width:100%;margin-top:14px;" onclick="WK.STORY11._qte.close()">继续</button>');
    },
    close(){
      WK.ui.closeOverlay("ov-generic");
      WK.EVT.resume();
    },
    die(){
      WK.ui.closeOverlay("ov-generic");
      WK.rules.erase("在激光通道中被防御激光杀死（三道激光选错两道）");
    }
  };

  Object.assign(WK.EVT.fnLib, {
    n11QteLaunch(){ WK.STORY11._qte.start(); },
    n11ClearAnchor(){
      if (WK.P.anchor.active) WK.rules.clearAnchor();
      WK.quest.add({ id:"q_route", type:"main", title:"抉择：随大部队走下水道（B线）或留守主机房（A线）", state:"active" });
    }
  });

  /* ============================================================
   * 豆包N12：正式剧情 · 第一集 A/B 双路线结局 + 回归主神空间
   * ------------------------------------------------------------
   * 抉择（n12_choice，进主机房 stage7 触发）：
   *   A 线·留守主机房（原著小说正线，稳）：四人背靠激光通道死守。
   *       红后激光劈死两只攻门爬行者 → 卡普兰为救电影主角远程关闭红后 →
   *       黑暗中一只爬行者撕穿最后大门、进入地图块主动索敌（特殊战，
   *       defeatMode:'return'）。【打赢】或【全队战死】都回归主神——死亡也算回归。
   *   B 线·随雇佣兵走下水道（电影后半，险、富）：半空通道猎杀、J.D. 被
   *       丧尸拖走、返程列车雷恩尸变、爬行者追车决战（战胜才回归；败=真死）。
   *
   * 时间规则：手表归零＝存活即可回归，身处任何位置都会被主神直接送走
   * （张杰原著口述）。终局战结束统一 rules.forceTimeUp() → finishWatch
   *  → STORY12.onTimeUp 把人传去主神空间（N13 在那里做四大类兑换）。
   * ============================================================ */
  WK.STORY12 = {
    MOVIE:["matthew","rain","jd","kaplan","alice","ryan","matt"],
    REINC:["zhangjie","zhengzha","zhanlan","lixiaoyi"],
    // 豆包v126：走 B 线（下水道）时，四名轮回者——张杰、郑吒、詹岚、李萧毅——全部留守主机房。
    // 玩家选 B 就是孤身随雇佣兵小队走（雇佣兵只是剧情 NPC，不入队），没有轮回队友协攻。
    REINC_B:[],
    REINC_STAY:["zhangjie","zhengzha","zhanlan","lixiaoyi"],

    /* 移动存活、（默认）不在玩家队伍里的人；在队队友留给 party.follow */
    moveAlive(room, ids, includeParty){
      (ids||[]).forEach(id=>{
        const st=WK.npcState(id);
        if (!st || !st.alive) return;
        if (!includeParty && WK.party && WK.party.has(id)) return;
        st.loc=room;
      });
    },

    /* 豆包v125：路线抉择唯一入口（talkNpc 与马修/张杰谈话后调用）。
       route="B" 走下水道、route="A" 留守主机房。郑吒/詹岚在 B 线会留下守主机房，
       即便已被邀入队也在此刻离队（本集核心剧情，不随玩家钻下水道）。*/
    chooseRoute(route){
      const p=WK.P;
      if (!p || p.flags.routeChosen) return;
      if (p.stage!==7 || !p.flags.shutdownDone) return;
      if (route!=="A" && route!=="B") return;
      p.flags.routeChosen=true;
      p.flags.routeA = (route==="A");
      p.flags.routeB = (route==="B");
      if (route==="B"){
        // 豆包v126：四名轮回者全部留守主机房；任何已入队者（郑吒/詹岚）此刻解散。玩家孤身走 B。
        this.REINC_STAY.forEach(id=>{
          if (WK.party.has(id)) p.party = p.party.filter(x=>x!==id);
          const st=WK.npcState(id); if (st) st.loc="core_room";
        });
        WK.save.write(); WK.renderScene && WK.renderScene();
        WK.EVT.run("n12_B_start");
      } else {
        WK.save.write();
        WK.EVT.run("n12_A");
      }
    },
    /* 当前是否处于「可在主机房找人谈路线」的状态（供 talkNpc 显示谈话按钮）*/
    canChooseRoute(){
      const p=WK.P;
      return !!(p && p.stage===7 && p.flags.shutdownDone && !p.flags.routeChosen);
    },
    /* talkNpc 里点【走B/留A】后的二次确认（重大抉择，防误触），确认后落路线 */
    askRoute(route){
      if (!this.canChooseRoute()) return;
      const isB = route==="B";
      WK.ui.dialog(isB ? "随马修走下水道？" : "随张杰留守主机房？",
        '<span class="sys">' + (isB
          ? "随雇佣兵钻进排水系统：穿半空维修通道、硬闯尸群，再登旧列车撤离。郑吒、詹岚会留在主机房。险，但奖励点机会更多。"
          : "与张杰、郑吒、詹岚死守主机房：三道钢门加激光防御通道，撑到手表归零即可——前提是中途别生变故。") + "</span>",
        [
          { text: isB ? "走下水道（B线）" : "留守主机房（A线）", primary:true,
            act:()=>{ WK.ui.closeOverlay("ov-dialog"); WK.ui.closeOverlay("ov-generic"); this.chooseRoute(route); } },
          { text:"再想想", act:()=>WK.ui.closeOverlay("ov-dialog") }
        ]);
    },

    /* 豆包v166：A 线自由搜刮期，玩家回到主机房（core_room）找张杰，即可主动开打最终战。
       条件：已选 A、雇佣兵已撤离（n12_A 跑完置 routeAFreeExplore）、最终战尚未触发、人在主机房。 */
    canTriggerAFinal(){
      const p=WK.P;
      return !!(p && p.flags.routeChosen && p.flags.routeA && p.flags.routeAFreeExplore
        && !p.flags.aFinalTriggered && !p.flags.returned
        && p.location==="core_room");
    },
    askTriggerAFinal(){
      if (!this.canTriggerAFinal()) return;
      WK.ui.dialog("锁门，开始死守？",
        '<span class="sys">让张杰扳下门闸，立刻进入「红后警报 → 激光 → 远程断电 → 爬行者破门」的连续决战。<br>' +
        '<b style="color:#e08090;">一旦开始就无法再离开或搜刮；无论打赢还是全队战死，这一战结束都会被主神收回（死亡也算回归）。</b></span>',
        [
          { text:"锁门，开始死守", danger:true, primary:true, act:()=>{
              const p=WK.P;
              p.flags.aFinalTriggered=true;
              WK.save.write();
              WK.ui.closeOverlay("ov-dialog"); WK.ui.closeOverlay("ov-generic");
              WK.EVT.run("n12_A_final");
            } },
          { text:"再等等，我还想搜点东西", act:()=>WK.ui.closeOverlay("ov-dialog") }
        ]);
    },

    register(){
      const E=WK.EVENTS;

      /* ===== 豆包v125：抉择前的集结（不再自动弹二选一）=====
         关红后、丧尸潮退守后，雇佣兵全队与轮回小队都聚在红后主控室。
         真正的路线由玩家亲自找人谈出来：和【马修】谈→随队走下水道(B)；和【张杰】谈→留守主机房(A)。*/
      E.n12_choice = { once:true,
        when:{ trigger:"enter", room:"core_room", if:p=>p.stage===7 && p.flags.shutdownDone && !p.flags.routeChosen },
        script:{ id:"n12_choice", lock:true, title:"主机房 · 下一步",
        steps:[
          { act:[ ["fn","n12GatherCore"] ] },
          { narr:"主机房里，马修的小队正拆下火焰女皇主板、准备从维护终端旁的下水道撤离；轮回队的几人也都退到了这里。两方人各据一角，都在等你拿主意。" },
          { who:"matthew", say:"（检查着枪膛）我带队伍走排水系统，穿过去有趟旧列车能回地面。想活命、信得过火力的，就跟我走——不过我丑话说前头，下面什么都可能有。" },
          { who:"zhangjie", say:"（靠墙抱着胳膊，嗤了一声）我可不陪他们钻下水道。三道钢门加一条激光防御通道，整个蜂房再没比这主机房更硬的乌龟壳。想稳的，留下。" },
          { who:"zhengzha", say:"（看了看詹岚，又看向你）……你怎么选？我们听你的。" },
          { narr:"红后既已关闭，蜂房里那些被她锁死的门——武器库、样本库、后勤区、安保犬舍——此刻全都开着；被关在门后的东西，也一起放了出来。在你拍板走哪条路之前，全队都在主机房等着，你还来得及独自折回去，趁乱再搜刮一趟。" },
          { god:"这是撤离前最后的搜刮机会：现在可以自由离开主机房、折返蜂房抢物资（红后一关，门全开、丧尸也全放了，贪多有风险）。一旦随马修下井（B线）或留守死守（A线），就再回不到这些房间。\n准备好了就去和在场的人谈：找马修谈→走下水道（B线·险）；找张杰谈→留守主机房（A线·稳）。", fast:false },
          { choices:[ { text:"（看看马修，又看看张杰——先找人问问清楚。）", primary:true } ] }
        ]}
      };

      /* ===== A 线·上：雇佣兵撤离 → 玩家自由搜刮（不立刻终战）=====
         豆包v166 重做（旧版选 A 一镜到底，打赢/战死还可能因回调没接通干等真实 3 小时）：
         选 A 只播到雇佣兵钻下水道撤走，随后放玩家离开主机房自由搜刮；
         想决战时【回主机房找张杰对话】触发 n12_A_final；拖到手表归零也照常回归。 */
      E.n12_A = { once:true,
        script:function(P){ return { id:"n12_A", lock:true, title:"A 线 · 雇佣兵撤离",
        steps:[
          { act:[ ["stage",8], ["goto","core_room"],
                  ["fn","n12AMovieLeave"] ] },
          { who:"matthew", say:"……我明白了。卡普兰，把激光通道的防御系统打开，让他们待在主机房里。不要死了。" },
          { narr:"雇佣兵们逐一钻进下水道。两队人隔着激光通道两头的玻璃门对望，彼此眼里都是一种怜悯——谁也不知道对方会撞上什么。" },
          { who:"zhangjie", say:"（掏出烟，松了口气）三层钢门加一道激光，稳了。红后这一关门全开，被她锁着的东西也全放出来了——想趁乱再去捞点什么，现在就是时候。" },
          { who:"zhangjie", say:"拿够了就回主机房找我，我把门锁死，咱在这儿撑到手表归零。你要是在外面磨蹭到时间跳零，主神照样会把你收走。去吧，快去快回。" },
          { god:"A 线 · 自由搜刮：红后已关，蜂房各门全开（武器库 / 样本库 / 后勤区都能进，但丧尸也一起放了出来）。可随时离开主机房折返搜刮，三小时倒计时继续走。\n想提前进入死守决战，就【回到主机房和张杰对话】；在外面拖到手表归零，同样回归主神空间。", fast:false },
          { choices:[ { text:"（记清主机房的位置，先去搜刮。）", primary:true } ] }
        ],
        onDone(){ const p=WK.P; if(p){ p.flags.routeAFreeExplore=true; WK.save.write(); } }
        };}
      };

      /* ===== A 线·下：回主机房找张杰 → 激光 → 断电 → 爬行者破门死战 → 胜/败都立即回归 =====
         由 STORY12.askTriggerAFinal() 触发（talkNpc 张杰，仅 A 线自由期、人在主机房可见）。
         关键：最终战的 onWin 与 onDefeat 都直接 forceTimeUp()，battle 又是本事件最后一步，
         EVT 包装器随后 resume() 时已无后续 step；onTimeUp 自带 returned 防重入，杜绝卡 3 小时。 */
      E.n12_A_final = { once:true,
        script:function(P){ return { id:"n12_A_final", lock:true, title:"A 线 · 死守主机房",
        steps:[
          { act:[ ["goto","core_room"] ] },
          { who:"zhangjie", say:"都回来了？好。（一把将主机房门闸扳下）从现在起谁也别再出去——门我锁死了，死守到点。" },
          { who:"redqueen", say:"两只爬行者正在攻击最外围大门，大门还能维持封锁四十秒。" },
          { narr:"轰！轰！钢铁大门被撞得巨响，尖锐的爪尖已经在十多厘米厚的钢板上顶出一个个凸点。众人猛地冲到玻璃窗口。" },
          { who:"zhengzha", say:"它们冲进来只是时间问题！三道门挡不住这种怪物！" },
          { choices:[
            { text:"那怎么办？我们手里就几把枪，硬拼是死！", primary:true },
            { text:"我们可以从下水道入口跑吗？现在追还来得及！" }
          ]},
          { who:"zhangjie", say:"追不上了，井盖一封、窄道里被它从背后扑，死得更快。这屋里还有个能谈条件的——火焰女皇！" },
          { narr:"你和郑吒几乎同时把枪指向了主机核心。" },
          { who:"zhengzha", say:"打开防御系统保护我们，或者让它冲进来——可在那之前，我会先一枪打烂你的主板！到时候多少带毒体会冲上地面，你自己算！" },
          { who:"zhanlan", say:"电脑不可以随便质问人类。我们待在这死活都不会让病毒扩散，你有什么理由不保护我们，火焰女皇？" },
          { who:"redqueen", say:"……明白了。爬行者无法通过最终防御设施。" },
          { narr:"通道里白光一闪，一条激光细线疾速掠过——两只正要扑门的爬行者被齐齐切成两截，巨大的躯体轰然落地。四人同时长出一口气。" },
          { narr:"就在这时，整个主机房猛地一暗。应急灯全灭，激光通道也沉入一片漆黑。" },
          { who:"zhangjie", say:"妈的！情节！这段我怎么忘了——卡普兰为了救外面的人，远程关闭了火焰女皇！激光，没了！" },
          { narr:"【记忆闪回】你想起来了：男女主角被锁在研究间、爬行者攻门，卡普兰就是在这一刻用遥控关掉了红后。你们这道最坚固的防线，瞬间失效。" },
          { narr:"绝对的黑暗里，只剩呼吸声与心跳。门外，传来一声粗重的喘息，接着是利爪缓慢刮擦钢铁的声响——刮的，是最后一道门。" },
          { who:"zhanlan", say:"（气声）还有多久……手表上还有多久？" },
          { who:"zhengzha", say:"（也压着嗓子）几分钟……撑住，就几分钟！" },
          { narr:"砰！钢板被撕开一个口子，赤红色的巨大身影挤了进来，没有眼睛，舌信垂落，一双堪比钢铁的巨爪锁死了你们。它沿着激光通道，扑进了这个房间。" },
          { god:"爬行者已进入主机房，主动索敌！这一战——打赢它，或全队倒在它爪下，手表都将跳到 00:00，主神会把你们一并收回。" },
          { act:[ ["stage",11], ["goto","core_door"],
                  ["battle",{ room:"core_door", title:"最终战 · 爬行者破门", noFlee:true,
                    defeatMode:"return",
                    wave:[ {id:"crawler", count:1} ],
                    allies:[
                      { id:"zhangjie", name:"张杰", atk:30, hit:0.30, crit:0.30, line:"张杰的沙漠之鹰轰然炸响" },
                      { id:"zhengzha", name:"郑吒", atk:18, hit:0.12, crit:0.12, line:"郑吒抬手枪响" },
                      { id:"zhanlan",  name:"詹岚", atk:9,  hit:0.16, crit:0.05, line:"詹岚冷静地报出方位，随即补了一枪" }
                    ],
                    onWin:function(){ WK.rules.forceTimeUp(); },
                    onDefeat:function(){ WK.rules.forceTimeUp(); }
                  }] ] }
        ]
        };}
      };

      /* ===== B 线：随队下井 ===== */
      E.n12_B_start = { once:true,
        script:{ id:"n12_B_start", lock:true, title:"B 线 · 下水道撤离",
        steps:[
          { narr:"你走向马修，点了点头。张杰没拦你，只把烟掐灭在掌心：「行，胆子不小。我守主机房，不陪你钻下水道——自己选的路，别死在半道上。」" },
          { who:"lixiaoyi", say:"（缩到张杰身后）我、我也留下……这门和激光通道好歹能挡一挡，下面黑咕隆咚的我不去……" },
          { who:"zhengzha", say:"（和詹岚对视一眼，上前一步，却不是冲检修口）我和詹岚也留在主机房。三道钢门加激光通道，我们守得住。你一个人跟他们走，千万小心。" },
          { who:"zhanlan", say:"（推了推眼镜，迅速而冷静）记住两点：下水道里小心天花板——电影里的东西习惯从头顶扑下来；还有，一旦你们都下去，我和郑吒会从里面把检修口焊死、顶上钢柜，既防丧尸追下来，也……断了你们的退路。你们只能一路向前。" },
          { who:"zhengzha", say:"（冲你伸出手，重重一握）等手表归零，咱们主神那儿见。一定要活着。" },
          { act:[ ["stage",9], ["goto","core_console"], ["fn","n12BSquadDown"] ] },
          { who:"matthew", say:"（在检修口前回头）那些「保安」都留下守门，就你一个跟队？够种。下面是排水系统，穿过去有一趟旧列车能回地面。谁掉队，没人会等。" },
          { narr:"金属盖板被掀开，一股潮湿腐臭涌上来。雇佣兵率先沿铁梯下到竖井深处；你最后看了一眼主机房里张杰四人的身影，深吸一口气，跟着钻了进去。" },
          { god:"B 线开启：你孤身随雇佣兵小队走下水道（轮回队友全部留守主机房）。一路向前、抵达旧站台登返程列车——身后的管道很快会被封死，没有回头路。", fast:false },
          { choices:[ { text:"（向南钻进漆黑的排水竖井。）", primary:true } ] }
        ]}
      };

      /* 豆包v123：半空通道——J.D. 被拖走，不再是写死的过场，而是一场「可救 / 可弃」的苦战。
         过场只负责把局面摆出来并激活 WK.rescue（J.D. 进入「苦战中」、可点名字营救）；
         真正的尸群战斗、J.D. 死活、阶段推进都交给可复用的 WK.rescue 模块处理。*/
      E.n12_B_walkway = { once:true,
        when:{ trigger:"enter", room:"sw_walkway", if:p=>p.stage===9 && p.flags.routeB },
        script:{ id:"n12_B_walkway", lock:true, title:"半空维修通道",
        steps:[
          { narr:"你踩上高架在下水道半空的锈蚀维修通道，脚下是看不见底的黑水。天花板的管线间，似乎有什么东西飞快地掠过，带下一蓬锈屑。" },
          { who:"rain", say:"别抬头看太久，走中间！这些鬼东西会从顶上——" },
          { narr:"通道两端同时响起拖沓的脚步声，成群的丧尸堵住了前后护栏。混乱中，断后的 J.D. 被几只从侧管扑出的丧尸一把拽向栏杆外，大半个身子悬到了黑水上空。" },
          { who:"jd", say:"（一只手死死抠住锈蚀栏杆，另一只手的枪还在零星开火）该死——搭把手！！" },
          { who:"matthew", say:"J.D.——！……全体压制两端，别让尸群合拢！" },
          { narr:"他还挂在那儿。你很清楚：现在扑到栏杆边开枪，就得和这群丧尸正面硬碰；可只要你转身随大部队先走，他绝对撑不过你离开这一格。" },
          { choices:[ { text:"（冲到栏杆边，看清他的情况。）", primary:true } ] }
        ],
        onDone(){ WK.rescue.start("jd_sw"); } }
      };

      /* 豆包v123：选择【帮助】并打赢尸群后——J.D. 活下来（改变命运），随队撤向旧站台。*/
      E.n12_B_jd_saved = { once:true,
        script:{ id:"n12_B_jd_saved", lock:false, title:"半空维修通道",
        steps:[
          { narr:"你扑到栏杆边，枪口几乎顶着丧尸的头颅开火，把死死拽着 J.D. 的那些东西一只接一只轰下黑水。马修与艾丽丝的火力从两侧压上，尸群被逼得连连后退。" },
          { who:"jd", say:"（被你一把拽回通道，半跪着大口喘气，冲你哑声）谢了，兄弟……我 J.D. 欠你一条命。" },
          { who:"matthew", say:"带上他，撤！南边有维修梯，下到旧站台——车不等人！" },
          { god:"你救下了本应命丧下水道的 J.D.。命运的轨迹，因你偏了一寸。奖励点 +10。" },
          { choices:[ { text:"（架起 J.D.，且战且退冲向维修梯。）", primary:true } ] }
        ]}
      };

      /* 豆包v123：选择【离开】（或没救就走）后再回到半空通道——J.D. 的尸体还在这里。*/
      E.n12_B_corpse = { once:true,
        when:{ trigger:"enter", room:"sw_walkway",
               if:p=>p.stage>=10 && p.flags.routeB && p.flags.rescueJd==="dead" },
        script:{ id:"n12_B_corpse", lock:false, title:"半空维修通道",
        steps:[
          { narr:"你重新踏回这条半空维修通道。护栏外翻着一具被啃得残缺不全的尸体，半个身子泡进乌黑的污水里——是 J.D.。他到底没能撑过你离开的那几步。" },
          { narr:"铁锈与腐臭压过了下水道原本的潮气。这里已经没有活物，只有黑水还在缓慢地、一下一下拍着管壁。" },
          { choices:[ { text:"（沉默片刻，转身离开。）", primary:true } ] }
        ]}
      };

      /* 豆包v123：script 改函数——J.D. 被你救下(rescueJd==="saved")时，站台上多一句他的戏。*/
      E.n12_B_station = { once:true,
        when:{ trigger:"enter", room:"tb_platform", if:p=>p.stage===10 && p.flags.routeB },
        script:function(p){
        const steps=[
          { narr:"排水系统尽头，一座废弃旧站台亮着忽明忽暗的灯，一列老旧通勤列车静静停在轨道上，车门敞开。" },
          { who:"rain", say:"（被人架着，脸色灰白，手还在渗血）我没事……只是有点冷……让我歇一会……" },
          { who:"kaplan", say:"（盯着雷恩发黑的伤口，压着声音凑到你耳边）……她被咬的时间，已经太久了。盯紧点，伙计。" }
        ];
        if (p.flags.rescueJd==="saved")
          steps.push({ who:"jd", say:"（胳膊上缠着撕烂的布条，仍把枪攥得死紧，冲你点头）别这么看我，欠的那条命，我用子弹还。上车，我殿后。" });
        steps.push({ who:"matthew", say:"全部上车！车门一关就发车，这是离开蜂房的最后一程！" });
        steps.push({ act:[ ["fn","n12BMoveTrain"] ] });
        steps.push({ choices:[ { text:"（登上返程列车。）", primary:true } ] });
        return { id:"n12_B_station", lock:true, title:"排水系统 · 旧站台", steps:steps };
        }
      };

      /* 豆包v123：script 改函数——爬行者追车决战，若 J.D. 存活则多一把雇佣兵火力助战。*/
      E.n12_B_train = { once:true,
        when:{ trigger:"enter", room:"tb_train", if:p=>p.stage===10 && p.flags.routeB },
        script:function(p){
        const allies=[
          { id:"alice", name:"艾丽丝", atk:28, hit:0.22, crit:0.18, line:"艾丽丝借车身一晃精准点射" },
          { id:"matthew", name:"马修", atk:20, hit:0.18, crit:0.10, line:"马修抵着护栏连射" }
        ];
        if (p.flags.rescueJd==="saved")
          allies.push({ id:"jd", name:"J.D.", atk:18, hit:0.14, crit:0.08, line:"J.D. 抵着车厢门沉稳连射，还你那一命" });
        return { id:"n12_B_train", lock:true, title:"返程列车 · 最后一程",
        steps:[
          { act:[ ["stage",11] ] },
          { narr:"车门闭合，车身猛地一震，驶入通往地面的黑暗隧道。雷恩蜷在车厢角落，呼吸越来越重，皮肤下的血管正以肉眼可见的速度变黑。" },
          { who:"rain", say:"我……好冷……为什么……这么……" },
          { narr:"她猛地抬头，眼白已经翻成浑浊的灰白，喉咙里发出不属于活人的嘶吼，朝离她最近的艾丽丝扑了过去。" },
          { who:"alice", say:"雷恩——！！……对不起。" },
          { god:"枪声在封闭车厢里炸开。雷恩，尸变，被艾丽丝击毙。" },
          { act:[ ["die","rain","雷恩在返程列车上 T 病毒发作尸变，被艾丽丝含泪击毙。"] ] },
          { narr:"车顶突然传来金属被巨力撕裂的巨响，整节车厢剧烈一晃——一只赤红色的爬行者破开车顶倒挂而入，舌信垂落，巨爪在扶手上犁出火星。它一路追猎到了这趟车上。" },
          { who:"matthew", say:"就是现在——所有人，集火打它！车就快到地面了，撑住！" },
          { choices:[ { text:"（贴紧车厢，瞄准那没有眼睛的头颅！）", primary:true } ] },
          { act:[ ["battle",{ room:"tb_train", title:"最终战 · 爬行者追车", noFlee:true,
                  wave:[ {id:"crawler", count:1} ], allies:allies } ] ] },
          { narr:"爬行者庞大的身躯终于在弹雨中轰然倒地，顺着颠簸滑到车厢尽头。前方隧道尽头，已能看见地面站台的一线白光。手表数字跳到了 00:00。" },
          { god:"时间到。光柱自上而下，穿透车厢，将幸存者笼罩。" },
          { choices:[ { text:"（靠着冰冷的车厢壁，闭上了眼。）", primary:true } ] }
        ],
        onDone(){ WK.rules.forceTimeUp(); }
        };}
      };

      /* ===== 回归主神空间（由 STORY12.onTimeUp 调用，N13 在 g_orb 接兑换）===== */
      E.n12_return = { once:true,
        script:{ id:"n12_return", lock:false, title:"回归 · 主神空间",
        steps:[
          { narr:"白光散尽，失重感只持续了一瞬。你脚下重新踩到坚实而无形的地面——四周是一片望不到边的虚空，没有墙，也没有顶。" },
          { narr:"前方半空中，悬浮着一颗缓缓旋转、散发柔和金光的巨大光球。一股庞大而平静的意识拂过你的脑海，无数信息在其中流淌：武器、血统、功法、机甲、丹药、生活的天数……" },
          { who:"zhangjie", say:"（他也被送了过来，吐了口浊气）到了。这就是「主神」。想兑换、想查询、想强化，用意识直接跟那颗光球说就行。" },
          { god:"《生化危机一》存活结算已到账。走到光球前，开始你的第一次兑换（下一节开放）。" },
          { choices:[ { text:"（走向那颗金色的光球。）", primary:true } ] }
        ]}
      };
    },

    /* 时间到 / 终局战结束：统一回归。防重入；只把存活轮回者接回主神空间，
       电影角色留在他们自己的世界。forceTimeUp/finishWatch 在事件 onDone
       （cur 已清空）后调用，故这里 run 新事件不会与旧事件冲突。 */
    onTimeUp(){
      const p=WK.P;
      if (!p || p.flags.returned) return;
      p.flags.returned=true; p.flags.canReturn=true;
      p.stage=12;
      // 豆包v142：回归光柱，本世界的门禁卡/情报/制式武器医疗品（bind:"world"）一律带不走，被主神收缴；
      // T病毒原液/抗病毒血清/贵重品/红后核心与兑换装备保留。记一句流水，玩家在背包里能直观看到它们消失。
      if (WK.inv && WK.inv.stripWorldBound) {
        const taken = WK.inv.stripWorldBound();
        if (taken.length) {
          const names = taken.map(x => (WK.ITEM_DEF[x.id] ? WK.ITEM_DEF[x.id].name : x.id) + "×" + x.n).join("、");
          WK.log("sys", "【主神收缴】本世界的物资无法带出：" + names + " 已在回归光中化散。能带走的只有兑换来的装备/道具，以及少数跨世界素材。");
        }
      }
      // v216：回归主神空间时，NPC移到各自房间（不是g_plaza）
      const godRoomMap = {
        zhangjie: "g_room_zhang",
        zhengzha: "g_room_zheng",
        zhanlan: "g_room_zhan",
        lixiaoyi: "g_room_lixiao",
        luoli: "g_room_zheng",
        naer: "g_room_zhang"
      };
      Object.keys(godRoomMap).forEach(id => {
        const npc = WK.P.npcs[id];
        if (npc && npc.alive) npc.loc = godRoomMap[id];
      });
      if (WK.quest.get("q_route")) WK.quest.setState("q_route","done",true);
      WK.save.write();
      WK.teleport("g_arrive", true);
      if (typeof WK.renderScene==="function") WK.renderScene();
      setTimeout(()=>{ if (WK.EVT) WK.EVT.run("n12_return"); }, 220);
    }
  };
  WK.STORY12.register();

  Object.assign(WK.EVT.fnLib, {
    // 豆包v125：A/B 抉择前，把雇佣兵全队与轮回小队（存活者）都聚到红后主控室
    n12GatherCore(){
      WK.STORY12.moveAlive("core_room", WK.STORY12.MOVIE.concat(WK.STORY12.REINC), true);
    },
    // A线：阶段8 全员已在主机房；电影角色下井离开，四名轮回者（含玩家）留守
    n12AMovieLeave(){
      WK.STORY12.moveAlive("core_sewer", WK.STORY12.MOVIE, true);
    },
    // 豆包v125 B线：随队下到半空通道的是雇佣兵全队 + 张杰、李萧毅；郑吒、詹岚留守主机房
    n12BSquadDown(){
      WK.STORY12.moveAlive("sw_walkway", WK.STORY12.MOVIE.concat(WK.STORY12.REINC_B), false);
    },
    // B线：半空通道一段了结（J.D. 被救/被弃）后，幸存者推进到旧站台；若 J.D. 被救下则随队
    n12BSquadStation(){
      const ids=["matthew","rain","kaplan","alice","ryan","matt"].concat(WK.STORY12.REINC_B);
      if (WK.P.flags.rescueJd==="saved") ids.push("jd");
      WK.STORY12.moveAlive("tb_platform", ids, false);
    },
    // 上车：把幸存者摆进返程车厢（J.D. 存活时一同上车，参与爬行者追车决战）
    n12BMoveTrain(){
      const ids=["matthew","rain","kaplan","alice","ryan","matt"].concat(WK.STORY12.REINC_B);
      if (WK.P.flags.rescueJd==="saved") ids.push("jd");
      WK.STORY12.moveAlive("tb_train", ids, false);
    }
  });

