/* ============================================================
 * 04-ui.js — UI渲染
 * 覆盖层、通用小窗、剧情对话、场景渲染、小地图、人物卡
 * ============================================================ */

  /* ============================================================
   * 五、覆盖层 / 通用小窗 / 剧情对话
   * ------------------------------------------------------------
   * WK.dialog(name, html, actions)
   *   actions: [{ text, primary?, danger?, act }]，act 为点击回调；
   *            不传 act 时点击仅关窗。需要链式对话时在 act 里再开 WK.dialog。
   * WK.generic(title, html) ：无按钮小窗，点「关闭」或按钮自管。
   * ============================================================ */
  WK.ui = WK.ui || {};

  WK.ui.closeOverlay = function (id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove("active");
  };
  WK.ui.closeAll = function () {
    document.querySelectorAll(".overlay.active").forEach(el => el.classList.remove("active"));
  };

  WK.ui.generic = function (title, html) {
    document.getElementById("generic-title").textContent = title;
    document.getElementById("generic-body").innerHTML = html;
    document.getElementById("ov-generic").classList.add("active");
  };

  WK.ui.dialog = function (name, html, actions) {
    document.getElementById("dialog-name").textContent = name || "对话";
    document.getElementById("dialog-body").innerHTML = html;
    const box = document.getElementById("dialog-actions");
    box.innerHTML = "";
    (actions || [{ text: "……" }]).forEach(o => {
      const b = document.createElement("button");
      b.className = "here-btn" + (o.primary ? " primary" : o.danger ? " danger" : "");
      b.textContent = o.text;
      b.onclick = () => {
        if (o.act) o.act();
        else WK.ui.closeOverlay("ov-dialog");
      };
      box.appendChild(b);
    });
    document.getElementById("ov-dialog").classList.add("active");
  };

  /* ============================================================
   * 六、场景渲染：地点 + 描述 + 3x3 方位图 + 区域/小地图信息
   * ============================================================ */
  WK.renderScene = function () {
    WK.assertLocation();
    const p = WK.P;
    if (!p) return;
    const r = WK.ROOMS[p.location];
    document.getElementById("nav-loc").textContent = r.name;
    WK.renderWatchHUD();
    document.getElementById("scene-desc").textContent = r.desc;
    WK.renderDirMap(r);
    if (WK.SPOTS) WK.SPOTS.render(r);                       // 豆包v128：场景互动点（搜查/开箱/精英怪/道具）
    if (WK.OBJ) WK.OBJ.render(r);                          // 豆包v129：成排可搜刮物件
    WK.renderPeople();
    WK.renderMapInfo(r);
    if (WK.battle && WK.battle.renderEncounter) WK.battle.renderEncounter(r); // 豆包N6：本房遭遇入口
    if (WK.STORY11 && WK.STORY11.renderWaitEntry) WK.STORY11.renderWaitEntry(); // 豆包v118：探路原地等待入口
    if (WK.SHOP && WK.SHOP.renderOrbEntry) WK.SHOP.renderOrbEntry(r);          // 豆包N13：光球房兑换入口
  };

  /* ============================================================
   * 豆包N3：3x3 方位图（移植江湖版手感，生化冷色配色）
   * 当前房间居中，八个方向出口显示目标房间名；点击即移动。
   * ============================================================ */
  const DIR_POS = {
    northwest:{x:48,y:17}, north:{x:144,y:17}, northeast:{x:240,y:17},
    west:{x:48,y:53}, east:{x:240,y:53},
    southwest:{x:48,y:89}, south:{x:144,y:89}, southeast:{x:240,y:89}
  };
  const CENTER_POS = { x:144, y:53 };
  const OPPOSITE = { N:"S", S:"N", E:"W", W:"E" };
  // 八方向大写键 → 方位图坐标键
  const DIR_KEY2POS = { NW:"northwest", N:"north", NE:"northeast", W:"west", E:"east",
                        SW:"southwest", S:"south", SE:"southeast" };

  WK.renderDirMap = function (r) {
    const exits = r.exits || {};
    const cell = D => {
      const info = WK.exitInfo(exits[D]);
      if (!info) return '<div class="map-cell"></div>';
      const t = WK.ROOMS[info.to];
      if (!t) return '<div class="map-cell"></div>';
      // 豆包v137 修：带锁门只有「当前确实还没解锁」才画锁（关红后/持卡后 lockOpen=true 即正常显示）；漫游模式不阻挡故不显锁
      const stillLocked = !!info.lock && !WK.FREE_ROAM && !WK.lockOpen(info.lock, WK.P);
      const lockBadge = stillLocked ? '<span class="lock-tag">锁</span>' : "";
      const crossZone = t.zone !== r.zone ? '<span class="zone-tag">区</span>' : "";
      // 豆包N3：相邻房间直接显示名字（站在门口看得到通往何处）
      return '<div class="map-cell"><div class="map-node' + (stillLocked ? " locked" : "") +
        '" onclick="WK.goDir(\'' + D + '\')">' + crossZone + WK.roomShort(info.to) + lockBadge + "</div></div>";
    };

    // 进场动画方向
    let animCls = "map-anim";
    const ld = WK.P._lastDir;
    if (ld === "S" || ld === "SW" || ld === "SE") animCls = "map-anim-south";
    else if (ld === "W" || ld === "NW") animCls = "map-anim-west";
    else if (ld === "E" || ld === "NE") animCls = "map-anim-east";

    let h = '<div class="map-grid ' + animCls + '">';
    h += '<svg class="map-lines" viewBox="0 0 288 106" preserveAspectRatio="none">';
    ["NW","N","NE","W","E","SW","S","SE"].forEach(D => {
      const info = WK.exitInfo(exits[D]);   // exits 键为大写 N/S/E/W
      if (!info || !WK.ROOMS[info.to]) return;
      const p2 = DIR_POS[DIR_KEY2POS[D]];
      h += '<line x1="' + CENTER_POS.x + '" y1="' + CENTER_POS.y + '" x2="' + p2.x + '" y2="' + p2.y +
           '" stroke="' + (info.lock ? "#6e4a34" : "#3d524c") + '" stroke-width="1.6"/>';
    });
    h += "</svg>";
    h += '<div class="map-row">' + cell("NW") + cell("N") + cell("NE") + "</div>";
    h += '<div class="map-row">' + cell("W") +
         '<div class="map-cell"><div class="map-node current">' + r.name + "</div></div>" +
         cell("E") + "</div>";
    h += '<div class="map-row">' + cell("SW") + cell("S") + cell("SE") + "</div>";
    h += "</div>";
    document.getElementById("map-container").innerHTML = h;
  };

  /* 豆包v126：原常驻「区域名 + 本区小地图 x/总数」信息条已删除——
     既占纵向空间，按钮上的 x/总数 还会向玩家剧透区域规模（楼梯关等于预告还剩多少层）。
     区域地形图改为收进【主神手表】里按需查看；WK.openZoneMap 保留，由手表入口调用。
     #here-section 当前无其它常驻内容，直接清空并隐藏，避免留下一道空边距。 */
  WK.renderMapInfo = function (r) {
    const el = document.getElementById("here-section");
    if (el) { el.innerHTML = ""; el.style.display = "none"; }
  };

  /* ============================================================
   * 豆包N4：在场人物渲染 + 占位交互
   * N4 只展示静态站位与档案，NPC 不会跟随、不会移动（N7 入队 / N8 移动）。
   * ============================================================ */
  const NPC_CAMP_META = {
    reincarn: ["轮回者", "#d8b15a"],
    movie:    ["剧情角色", "#5fae9d"],
    ai:       ["中央电脑", "#b794e0"]
  };
  WK.renderPeople = function () {
    const el = document.getElementById("people-container");
    const list = WK.npcsAt(WK.P.location);
    if (!el) return;
    if (!list.length) { el.innerHTML = ""; return; }
    let h = '<div class="people-sec"><div class="people-title">在场的人 · ' + list.length + "</div><div class=\"people-list\">";
    // 豆包N7：在队队友排前；豆包v123：苦战中待营救的 NPC 排到最前
    const pri=o=>((WK.rescue&&WK.rescue.isStruggling(o.id))?2:0)+(WK.party.has(o.id)?1:0);
    list.sort((a,b)=> pri(b)-pri(a));
    // 豆包v168：当前剧情门控要找的 NPC，整张人物卡给金色脉冲 +「问话」角标，明确告诉玩家点谁
    const gate = WK.storyGate();
    list.forEach(o => {
      const inParty = WK.party.has(o.id);
      const isGate = !!(gate && gate.npc === o.id);
      // 豆包v123：苦战中的 NPC 置顶、红框「苦战中」，点击打开营救面板而不是普通档案
      const struggling = !!(WK.rescue && WK.rescue.isStruggling(o.id));
      if (struggling) {
        h += '<div class="person is-struggle" onclick="WK.rescue.panel(\'' + WK.rescue.activeId() + '\')">' +
             '<div class="p-ava">' + o.def.ava + "</div>" +
             '<div class="p-meta"><div class="p-name">' + WK.npcDisplayName(o.id) +
             ' <span class="struggle-tag">苦战中</span></div>' +
             '<div class="p-role" style="color:#e08a8a;">被怪物拖住 · 点击营救</div></div></div>';
        return;
      }
      const roleTxt = inParty ? ("队友 · " + o.def.ally.role) : NPC_CAMP_META[o.def.camp][0];
      h += '<div class="person c-' + o.def.camp + (inParty?' is-ally':'') + (isGate?' is-gate':'') + '" onclick="WK.talkNpc(\'' + o.id + '\')">' +
           '<div class="p-ava">' + o.def.ava + (isGate?'<span class="gate-dot">!</span>':"") + "</div>" +
           '<div class="p-meta"><div class="p-name">' + WK.npcDisplayName(o.id) +
             (inParty?' <span class="ally-tag">队友</span>':"") +
             (isGate?' <span class="gate-tag">问话 ▸</span>':"") + "</div>" +
           '<div class="p-role">' + roleTxt + "</div></div></div>";
    });
    el.innerHTML = h + "</div></div>";
  };

  /* 点开 NPC 占位档案；首次查看标记 met 并存档 */
  WK.talkNpc = function (id) {
    const def = WK.npcDef(id), st = WK.npcState(id);
    if (!def || !st || !st.alive) return;
    // 豆包v168：剧情门控激活时，点「问话目标」NPC 主动拉起对应剧情（替代丢失的强制弹窗，读档可续）；
    // 点其他人只提示先找对的人，不推进、不打开普通档案。
    const gate = WK.storyGate();
    if (gate) {
      if (id === gate.npc) {
        if (WK.EVT && WK.EVT.cur && WK.EVT.cur.active) { WK.toast("先看完这一段", "gold"); return; }
        WK.EVT.run(gate.evId);
        return;
      }
      const targetName = (WK.npcDef(gate.npc) || {}).name || "带队的人";
      WK.toast(gate.askToast || ("先找" + targetName + "把情况问清楚"), "gold");
      return;
    }
    if (!st.met) { st.met = true; WK.save.write(); WK.renderPeople(); }
    const meta = NPC_CAMP_META[def.camp] || ["?", "#888"];
    const fav = WK.P.favor[id] || 0;
    const favTxt = fav === 0 ? "陌生" : (fav > 0 ? "好感 " + fav : "敌意 " + Math.abs(fav));
    // 豆包N4修正：「你记得的电影剧情」只对电影角色/红后显示；轮回者是和玩家一样被拉进
    // 恐怖片的真人，玩家只看过《生化危机》电影，无法从电影里预知这些小说人物的命运。
    const isMovieRole = (def.camp === "movie" || def.camp === "ai");
    const fateBlock = isMovieRole ?
      ('<div class="stat-sec" style="color:#9a8a4a;">你记得的电影剧情</div>' +
       '<div style="font-size:12px;color:#8a8060;line-height:1.7;margin:4px 0 14px;">' + def.fate + "</div>") :
      ('<div class="stat-sec" style="color:var(--dim2);">同伴</div>' +
       '<div style="font-size:12px;color:var(--dim);line-height:1.7;margin:4px 0 14px;">和你一样被「主神」拉进恐怖片的轮回者，他的命运不在你看过的电影里——只能并肩走下去才知道。</div>');
    // 豆包v122：所有轮回者统一战斗属性面板（中洲队模板）。引导者也只显示「表面 ally」，不暴露 allyReal。
    const inParty = WK.party.has(id);
    let allyBlock = "";
    if (def.ally) {
      const a = def.ally, pct = v => Math.round((v||0)*100);
      // 在队光环：正值=增益(绿)，负值=累赘，会拉低全队对应数值(红)
      let auraHtml = "";
      if (a.aura && (a.aura.hit || a.aura.charge)) {
        const parts = [];
        if (a.aura.hit)  parts.push('<span style="color:'+(a.aura.hit>0?'#9fd0a0':'#e08a8a')+';">全队命中'+(a.aura.hit>0?'+':'')+pct(a.aura.hit)+'%</span>');
        if (a.aura.charge) parts.push('<span style="color:'+(a.aura.charge>0?'#9fd0a0':'#e08a8a')+';">集气'+(a.aura.charge>0?'+':'')+pct(a.aura.charge)+'%</span>');
        auraHtml = '　·　' + parts.join("、");
      }
      // 豆包v125：本集仅郑吒/詹岚（def.recruitable）可邀，且要好感达标；其余轮回者本集不组队
      const recruitable = !!def.recruitable;
      const favNow = WK.party.favorOf(id), favNeed = def.favorRequired || 0;
      const unlocked = WK.party.recruitUnlocked();
      let statusTxt;
      if (inParty) statusTxt = "正在与你同行，战斗中会自动协攻。";
      else if (!recruitable) statusTxt = (def.team === "guide")
        ? "他始终和所有人隔着一层，客气，却谁也拉不动。"
        : "这一部恐怖片里，他有自己的路要走——不会与你结伴。";
      else if (!unlocked) statusTxt = "对方对你仍有戒心——先一起扛过些事，再谈组队。";
      else if (favNow < favNeed) statusTxt = "他还没完全信任你（好感 " + favNow + "/" + favNeed + "）——多在对话里站在他这边、危难关头拉他一把。";
      else statusTxt = "他已把你视作可托付后背的同伴：可以邀请同行，会随你移动、在战斗中协助你。";
      allyBlock =
        '<div class="stat-sec" style="color:var(--gold);">战斗属性 · ' + a.role + '</div>' +
        '<div style="font-size:12px;color:var(--dim);line-height:1.9;margin:4px 0 6px;">' +
          '生命 <b style="color:var(--txt);">' + a.hp + '</b>　火力 <b style="color:var(--txt);">' + a.atk + '</b>' +
          '　命中 <b style="color:var(--txt);">+' + pct(a.hit) + '%</b>　暴击 <b style="color:var(--txt);">' + pct(a.crit) + '%</b>' +
          auraHtml +
        '</div>' +
        '<div style="font-size:12px;color:var(--dim2);line-height:1.7;margin:0 0 10px;">战斗风格：' + (a.skill||"") +
          '<br>' + statusTxt + '</div>';
    }
    // 豆包v125：关系行右侧的招募状态标签（可邀/好感不足/本部不组队）
    let recruitTag = "";
    if (!inParty && def.ally) {
      if (WK.party.canRecruit(id)) recruitTag = '<span style="color:var(--gold);">可邀为战友</span>';
      else if (def.recruitable) {
        const fn2 = WK.party.favorOf(id), nd2 = def.favorRequired || 0;
        recruitTag = WK.party.recruitUnlocked()
          ? '<span style="color:#caa85a;">好感 ' + fn2 + "/" + nd2 + "</span>"
          : '<span style="color:var(--dim2);">仍有戒心</span>';
      } else if (def.team === "guide") recruitTag = '<span style="color:var(--dim2);">独来独往</span>';
      else recruitTag = '<span style="color:var(--dim2);">本部不组队</span>';
    }
    // 豆包v120：轮回队友（reincarn）档案一律给【交谈】+【邀请同行】两个按钮；
    // 能不能真的邀进来由 WK.tryInvite 当场判定：没建立信任前对方因怀疑/自保拒绝，引导者本集不站队。电影角色只有交谈。
    const isReincarn = (def.camp === "reincarn");
    let sideBtns = '<button class="here-btn" style="flex:1" onclick="WK.chatNpcNow(\'' + id + '\')">交谈</button>' +
      '<button class="here-btn" style="flex:1" onclick="WK.Fun.openGift(\'' + id + '\')">赠送</button>';
    if (isReincarn) {
      if (inParty)
        sideBtns += '<button class="here-btn" style="flex:1" onclick="WK.allyLeave(\'' + id + '\')">请其暂离</button>';
      else
        sideBtns += '<button class="here-btn primary" style="flex:1" onclick="WK.tryInvite(\'' + id + '\')">邀请同行</button>';
    }
    // 豆包v125：A/B 路线在红后主控室靠「找人谈」决定——找马修走下水道(B)、找张杰留守(A)
    let routeBlock = "";
    if (WK.STORY12.canChooseRoute() && (id === "matthew" || id === "zhangjie")) {
      const isB = (id === "matthew");
      routeBlock =
        '<div class="stat-sec" style="color:var(--gold);">路线抉择 · 全队等你拍板</div>' +
        '<div style="font-size:12.5px;color:var(--dim2);line-height:1.8;margin:4px 0 10px;">' +
          (isB
            ? "马修要带雇佣兵走排水系统，穿半空通道、过旧列车回地面——险，要硬闯尸群，也有机会多挣点数。"
            : "张杰主张死守主机房，背靠三道钢门与激光防御通道——稳，撑到手表归零即可，就怕节外生枝。") +
        "</div>";
      sideBtns += '<button class="here-btn primary" style="flex:1.4" onclick="WK.STORY12.askRoute(\'' +
        (isB ? "B" : "A") + '\')">' + (isB ? "随马修走下水道（B线）" : "听张杰的留守（A线）") + "</button>";
    }
    // 豆包v166：A 线雇佣兵撤离后进入自由搜刮期；回主机房找张杰可主动开打死守最终战
    let aFinalBlock = "";
    if (id === "zhangjie" && WK.STORY12.canTriggerAFinal()) {
      aFinalBlock =
        '<div class="stat-sec" style="color:var(--gold);">主机房 · 死守决战</div>' +
        '<div style="font-size:12.5px;color:var(--dim2);line-height:1.8;margin:4px 0 10px;">' +
        '雇佣兵已从下水道撤走，张杰、郑吒、詹岚留守主机房。东西搜够了，就能让张杰锁门死守。<br>' +
        '<b style="color:#e08090;">一旦开始即连战到回归（打赢或战死都回归），中途无法再离开。</b></div>';
      sideBtns += '<button class="here-btn primary" style="flex:1.4" onclick="WK.STORY12.askTriggerAFinal()">东西搜够了，开始死守</button>';
    }
    let h =
      '<div style="display:flex;gap:12px;align-items:center;margin-bottom:12px;">' +
        '<div class="p-ava" style="background:' + meta[1] + ';width:48px;height:48px;font-size:22px;">' + def.ava + "</div>" +
        '<div><div style="font-size:18px;font-weight:bold;color:var(--txt);">' + WK.npcDisplayName(id) +
          ' <span style="font-size:11px;color:' + meta[1] + ';border:1px solid ' + meta[1] + ';border-radius:4px;padding:1px 6px;">' + meta[0] + "</span></div>" +
        '<div style="font-size:12px;color:var(--dim);margin-top:3px;">' + def.title + "</div></div></div>" +
      '<div class="stat-sec">外形</div><div style="font-size:13px;color:var(--dim2);line-height:1.7;margin:4px 0 11px;">' + def.look + "</div>" +
      '<div class="stat-sec">此刻</div><div style="font-size:13px;color:var(--cyan);line-height:1.7;margin:4px 0 11px;">“' + WK.npcTalk(id) + '”</div>' +
      routeBlock +
      aFinalBlock +
      '<div class="stat-sec">关系</div><div style="font-size:12px;color:var(--dim);margin:4px 0 11px;">' + favTxt +
        (isReincarn ? '　·　<span style="color:var(--gold);">轮回队友</span>' : "") +
        (inParty ? '　·　<span style="color:var(--gold);">同行中</span>' : "") +
        (recruitTag ? '　·　' + recruitTag : "") + "</div>" +
      fateBlock +
      allyBlock +
      '<div style="display:flex;flex-wrap:wrap;gap:9px;">' +
        '<button class="here-btn" style="flex:1 1 70px" onclick="WK.ui.closeOverlay(\'ov-generic\')">离开</button>' +
        sideBtns +
      "</div>";
    WK.ui.generic(WK.npcDisplayName(id), h);
  };
  /* 豆包N7：档案内邀请/请离，操作后重开同一档案即时反映 */
  WK.allyInvite = function (id) { if (WK.party.join(id)) { WK.ui.closeOverlay("ov-generic"); setTimeout(function(){WK.talkNpc(id);},60); } };
  WK.allyLeave  = function (id) { WK.party.leave(id); WK.ui.closeOverlay("ov-generic"); setTimeout(function(){WK.talkNpc(id);},60); };

  /* 豆包v122：轮回队友【邀请同行】统一判定。
     · canRecruit(id) 为真（有 ally、活着、自我介绍后建立信任；小胖/妇女还须被你救下）→ 真正入队；
     · 引导者张杰本集始终不站队（藏身份），用专属审视句；
     · 其余人在「还没一起扛过事」前，第一反应是【怀疑你、要自保】，而不是客气地说怕拖累你——
       没人认识你，都怕被你利用、被推去挡丧尸。
     以后让新角色可入队：补 def.ally（+ needSave/team 按需）并在下面加一句怀疑台词即可。 */
  WK.RECRUIT_DOUBT = {
    zhengzha: "郑吒皱眉打量你：「组队？我凭什么信你。真撞上丧尸，你转头把我推出去挡枪怎么办？」",
    zhanlan:  "詹岚扶了扶眼镜，冷静地审视你：「我们连彼此底细都不清楚。这种时候结伴，不过是多一个互相提防的人。」",
    mougang:  "牟钢摇摇头，一双大巴掌攥得发白：「俺凭啥跟你？你手里又没枪。跟着拿枪的大兵，比跟你个生人靠谱。」",
    lixiaoyi: "李萧毅往后缩了缩：「我、我不跟你走……万一你拿我挡丧尸呢？我自己找地方躲着！」",
    fatty:    "小胖子直摆手：「别、别拉我！你跑得比我快，回头把我推去喂丧尸咋办？我谁也不信！」",
    woman:    "中年妇女哆嗦着直摇头：「我、我谁也不信……你别想哄我，我自己缩角落里还踏实点！」"
  };
  WK.RECRUIT_GUIDE = "张杰嗤地笑了，刀疤随嘴角扯起：「新人，少来这套拉山头的把戏。抱成团一起死的，我见得多了——你那点斤两，还不配让我跟着。」";
  /* 豆包v125：好感够但因【时机未到】（自我介绍前人人自危）时，郑吒/詹岚仍按怀疑/自保拒绝；
     过了自我介绍、只是好感不达标时，给明确的「还没信到那一步」反馈，玩家才知道刷好感有用。*/
  WK.RECRUIT_TRUST = {
    zhengzha: function(n){ return "郑吒看着你，迟疑了一下还是摇头：「你人不错，可我这条命不能随便押给别人。再一起扛过几桩事，我郑吒认你这个兄弟——现在，还不行。」（好感 "+n+"/2）"; },
    zhanlan:  function(n){ return "詹岚推了推眼镜，难得没有立刻回绝：「理智告诉我，多一个可托付的队友很重要。但信任不是几句话能建立的。等我真正确定你不会抛下同伴，再说吧。」（好感 "+n+"/2）"; }
  };
  WK.tryInvite = function (id) {
    const def = WK.NPCS[id], st = WK.npcState(id);
    if (!def || !st) return;
    const nm = WK.npcDisplayName(id);
    if (WK.party.has(id)) { WK.toast(nm + " 已经与你同行", "gold"); return; }
    if (st.alive === false) { WK.toast(nm + " 已经无法同行", "bad"); return; }
    if (WK.party.canRecruit(id)) {
      if (WK.party.join(id, "")) { WK.ui.closeOverlay("ov-generic"); setTimeout(function(){WK.talkNpc(id);},60); }
      return;
    }
    // 引导者张杰本集绝不站队
    if (def.team === "guide") { WK.toast(WK.RECRUIT_GUIDE, "gold"); return; }
    // 本集可入队（郑吒/詹岚）但差好感：自我介绍后给信任反馈；自我介绍前仍是怀疑/自保
    if (def.recruitable) {
      if (WK.party.recruitUnlocked() && WK.RECRUIT_TRUST[id])
        { WK.toast(WK.RECRUIT_TRUST[id](WK.party.favorOf(id)), "gold"); return; }
      WK.toast(WK.RECRUIT_DOUBT[id] || "他警惕地看着你，没有答应。", "gold"); return;
    }
    // 其余轮回者（牟钢/李萧毅/小胖/妇女）：本部恐怖片里各有命运，不与你组队
    WK.toast(WK.RECRUIT_DOUBT[id] || "他摇了摇头：这一部里，我自己顾自己。", "gold");
  };
  /* 豆包v117：真实「搭话」。听对方说一句符合当前阶段/处境的当下台词（随 stage 与旗标变化）。
     锁定剧情播放中不弹窗打断；不再有任何「N10 开放」之类的开发期提示。 */
  WK.chatNpcNow = function (id) {
    const def = WK.npcDef(id), st = WK.npcState(id);
    if (!def || !st || !st.alive) return;
    if (WK.EVT && WK.EVT.cur && WK.EVT.cur.active && WK.EVT.cur.lock) {
      WK.toast("眼前正有状况，先看完这一段", "gold"); return;
    }
    if (!st.met) { st.met = true; WK.save.write(); WK.renderPeople(); }
    const meta = NPC_CAMP_META[def.camp] || ["?", "#888"];
    const line = WK.npcTalk(id) || "……对方没有回应你。";
    const h =
      '<div style="display:flex;gap:10px;align-items:center;margin-bottom:10px;">' +
        '<div class="p-ava" style="background:' + meta[1] + ';width:40px;height:40px;font-size:19px;">' + def.ava + "</div>" +
        '<div style="font-size:16px;font-weight:bold;color:var(--txt);">' + def.name +
        ' <span style="font-size:11px;color:' + meta[1] + ';border:1px solid ' + meta[1] + ';border-radius:4px;padding:1px 6px;">' + meta[0] + "</span></div></div>" +
      '<div style="font-size:14px;color:var(--cyan);line-height:1.8;background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin-bottom:14px;">“' + line + '”</div>' +
      '<button class="here-btn primary" style="width:100%;" onclick="WK.ui.closeOverlay(\'ov-generic\')">（点头）</button>';
    WK.ui.generic("搭话 · " + def.name, h);
  };

  /* ============================================================
   * 豆包N4修正：NPC「此刻」台词解析（分阶段动态台词的统一入口）
   * ------------------------------------------------------------
   * 规则（N10 正式剧情填充时按此扩展，现阶段只有开场 stage 0）：
   *   def.talk  —— 字符串，开场（行驶列车苏醒）当下台词，必有。
   *   def.talks —— 可选，{ [stage]: 台词 } 或 { [stage]: fn(P) }，
   *                按 WK.P.stage（N8 定义主线阶段枚举）取当前阶段台词，
   *                取不到时回落 def.talk。也可用 flag/位置做更细判定。
   *   def.talk 若直接写成 function(P)，则每帧动态求值（特殊角色用）。
   * v117 起：stage>0 且该角色没有专属 talks[stage] 时，回落到 WK.npcIdleLine
   *   （按阵营 + 阶段取 STORY.STAGE_IDLE 情境句），不再把开场列车台词带到后面场景。
   *   要给某个角色写专属口吻，在其 NPCS 定义里加 talks:{ [stage]: 字符串或 fn(P) } 即可覆盖。
   * ============================================================ */
  WK.npcTalk = function (id) {
    const def = WK.npcDef(id);
    if (!def) return "";
    if (typeof def.talk === "function") return def.talk(WK.P) || "";
    const stage = WK.P ? WK.P.stage : 0;
    const t = def.talks && def.talks[stage];
    if (typeof t === "function") return t(WK.P) || WK.npcIdleLine(def, stage);
    if (typeof t === "string" && t) return t;
    // 豆包v117：stage0（列车苏醒）用作者写的开场 talk；之后没有专属台词时走分阶段情境兜底，不穿帮
    return stage === 0 ? def.talk : WK.npcIdleLine(def, stage);
  };

  /* 豆包v117：按阵营 + 阶段取「当下」兜底台词；红后按是否已关闭特判 */
  WK.npcIdleLine = function (def, stage) {
    const p = WK.P, f = (p && p.flags) || {};
    if (def.camp === "ai") {
      return f.redqueenOff ? "小女孩的全息影像闪烁了几下，彻底熄灭，终端只剩一片死寂的黑屏。"
                           : (def.talk || "一个小女孩形象的全息影像静静注视着你，声音没有一丝温度。");
    }
    const row = WK.STORY && WK.STORY.STAGE_IDLE[stage];
    if (row) {
      const key = (def.camp === "reincarn") ? "reincarn" : "movie";
      const v = row[key];
      const line = typeof v === "function" ? v(f) : v;
      if (line) return line;
    }
    return def.talk || "……他此刻没有多说什么，只是警惕地留意着四周。";
  };

  /* 豆包N3：移动。lock 在正式剧情下拦截；漫游模式放行并说明 */
  /* 豆包v126：B 线推进深度表（数字越大离主机房越远）。goDir 据此判定「想走回头路」并拦截。
     同深度房间互为横向岔路（半空通道 sw_walkway / 污水 sw_water / 侧管 sw_pipe / 维修梯 sw_ladder），允许互通。 */
  WK.BACK_SEAL_DEPTH = {
    core_room:0, core_console:1, core_teleport:1,
    core_sewer:2, sw_entry:3,
    sw_water:4, sw_walkway:4, sw_pipe:4, sw_ladder:4,
    sw_station:5, tb_platform:6, tb_train:7
  };
  /* ============================================================
   * 豆包v168：剧情门控（Story Gate）—— 解决「强制剧情窗一旦因存读档/误关丢失，
   * 玩家被丢在原地、剧情永不重放、卡死」的问题。
   * ------------------------------------------------------------
   * 思路：把「必须先做某件事（通常是找某个 NPC 问话）才能继续 / 离开」的卡点，
   *       从脆弱的「一次性弹窗」改成由【已存档的 stage / flags / evDone】实时推导的门控。
   *       · WK.storyGate() 命中 → goDir 一律拦下并给文案（新游戏、读档表现完全一致，天然可恢复）；
   *       · 对应 NPC 人物卡亮「问话」角标，点他 WK.talkNpc 主动 EVT.run 拉起剧情；
   *       · 剧情推进后 when() 不再成立，门控自动解除，无需手动清理。
   * 扩展：以后任何「先问某人 / 先看某物才能走」的卡点，照此格式往 STORY_GATES 加一条即可，
   *       不要去依赖「窗口是否还开着」这种不进存档、刷新即丢的状态。
   * ============================================================ */
  WK.STORY_GATES = [
    { id:"wake_brief",
      when:function(p){ return p.stage === 0 && !(p.evDone && p.evDone.n10_wake); },
      room:function(p){ return "ti_a"; },      // 被限制留在「行驶列车 · 苏醒车厢」
      npc:"zhangjie", evId:"n10_wake",
      askToast:"先找他把情况问清楚",
      toast:"你还不清楚状况，先别乱跑。",
      log:"你脑子一片混乱，四周全是荷枪实弹的陌生人和同样茫然的「新人」，贸然往车厢外走只会惹麻烦。先找身边那个脸上带疤、正转着一把手枪的黑发青年问问情况吧。"
    }
  ];
  /* 返回当前命中的门控（未完成的卡点）；无则 null。when 抛错按不命中处理，绝不可因门控本身卡死移动。 */
  WK.storyGate = function (p) {
    p = p || WK.P; if (!p) return null;
    for (let i = 0; i < WK.STORY_GATES.length; i++) {
      const g = WK.STORY_GATES[i];
      let ok = false; try { ok = !!g.when(p); } catch (e) { ok = false; }
      if (ok) return g;
    }
    return null;
  };

  WK.goDir = function (d) {
    const p = WK.P;
    const r = WK.ROOMS[p.location];
    const info = WK.exitInfo((r.exits || {})[d]);
    if (!info || !WK.ROOMS[info.to]) return;

    // v209：敲门机制——点NPC房间门，弹窗"敲门/算了"（用NPC key，不用姓氏拼音，避免撞名）
    const knockMap = {
      "g_room_zheng": { flag:"knock_zhengzha", npc:"郑吒", text:"门里隐约传来女孩的笑声——是郑吒造的萝丽。" },
      "g_room_zhan": { flag:"knock_zhanlan", npc:"詹岚", text:"门里隐约传来笔尖写字的沙沙声。" },
      "g_room_zhang": { flag:"knock_zhangjie", npc:"张杰", text:"门里隐约传来钢琴声——他那个旗袍女人在弹月光。" },
      "g_room_lixiao": { flag:"knock_lixiaoyi", npc:"李萧毅", text:"门里隐约传来什么东西的翻页声。" },
      "g_room_chuxuan": { flag:"knock_chuxuan", npc:"楚轩", text:"门里透出冷白的光——他在做实验。" },
      "g_room_lingdian": { flag:"knock_lingdian", npc:"零点", text:"门里传来子弹上膛的咔嗒声。" },
      "g_room_bawang": { flag:"knock_bawang", npc:"霸王", text:"门里传来机油味——他在拆机枪。" }
    };
    const knock = knockMap[info.to];
    if (knock && !p.flags[knock.flag]) {
      WK.ui.generic("敲门",
        '<div style="line-height:1.9;color:#c8d6c8;">你走到' + knock.npc + '的房门前。<br><br>' +
        knock.text + '<br><br>' +
        '要敲门吗？</div>' +
        '<div style="display:flex;gap:10px;margin-top:14px;">' +
        '<button class="here-btn primary" style="flex:1;padding:11px;" onclick="WK.P.flags[\'' + knock.flag + '\']=true;WK.save.write();WK.ui.closeOverlay(\'ov-generic\');WK.goDir(\'' + d + '\')">敲门</button>' +
        '<button class="here-btn" style="flex:1;padding:11px;" onclick="WK.ui.closeOverlay(\'ov-generic\')">算了</button>' +
        '</div>');
      return;
    }

    if (WK.EVT && WK.EVT.cur && WK.EVT.cur.active && WK.EVT.cur.lock) {
      WK.toast("剧情进行中，先看完这一段", "gold"); return;
    }
    // 豆包v168：剧情门控——命中未完成卡点时锁在原地，必须先找指定 NPC 问话推进。
    // 门控只由存档里的 stage/flags/evDone 推导，所以新游戏、读档、误关剧情窗都一致拦住且可恢复。
    const gate = WK.storyGate();
    if (gate) {
      p.flags._gateLog = p.flags._gateLog || {};
      if (!p.flags._gateLog[gate.id]) { p.flags._gateLog[gate.id] = 1; WK.save.write(); WK.log("sys", gate.log || gate.toast || "先把眼前的事情弄清楚再走。"); }
      WK.toast(gate.toast || "先把眼前的剧情推进了再走。", "gold");
      return;
    }
    // 豆包v120：搀扶的人「走不动了」瘫在台阶上，须先点「再坚持一下」才能继续下楼
    if (WK.STORY10 && WK.P.flags && WK.P.flags._restPending) {
      WK.toast("他还瘫在台阶上，先把人拽起来", "bad");
      return;
    }
    // 豆包v118：四人分头探路期间，玩家须在原地等待（可搭话），不能离开此地块
    if (WK.STORY11 && WK.P.flags.labSearchWait && WK.P.location === WK.STORY11.WAIT_ROOM) {
      WK.toast("还是在原地先等待吧。", "gold");
      WK.log("sys", "雷恩他们还在搜寻通路，单独离开只会掉队——还是在原地先等待吧。");
      return;
    }
    // 豆包v140（N21）：B 线选择即不可逆，搜刮窗口到此关闭。
    //  · 深度1 = 维护终端(core_console)：n12_B_start 用 goto 把玩家放到这里。此时再想 W/N 缩回主机房(0)，
    //    视为临阵退缩——雇佣兵已全部下井、郑吒詹岚开始顶死隔离门，只能向南下井。地上所有搜刮区从此不可达。
    //  · 深度≥2 = 已下到检修口/竖井：任何往更浅处走都拦下（郑吒詹岚焊死盖板）。
    // 同深度横移仍允许；雇佣兵为剧情 NPC，不受此限（fnLib 搬位）。
    if (p.flags && p.flags.routeB) {
      const depCur = WK.BACK_SEAL_DEPTH[p.location], depTo = WK.BACK_SEAL_DEPTH[info.to];
      if (depCur !== undefined && depTo !== undefined && depTo < depCur) {
        if (depCur === 1) {
          // 还在井口维护终端就想缩回主机房
          if (!p.flags._bDither1) {
            p.flags._bDither1 = true; WK.save.write();
            WK.log("sys", "你刚想退回主机房，检修井下已经传来马修不耐烦的催促；身后隔离门那头，钢柜拖行、死死顶门的闷响一声接一声——郑吒、詹岚在把你和主机房彻底隔开。选了这条路，就只剩向南。");
          } else {
            WK.toast("雇佣兵都在井下等你，只能向南", "gold");
          }
          return;
        }
        if (depCur >= 2) {
          if (!p.flags._bBackSealed) {
            p.flags._bBackSealed = true; WK.save.write();
            WK.log("sys", "「哐——！」头顶的金属盖板被人从上面狠狠合上，紧接着是钢柜拖行、死死顶住入口的闷响。郑吒、詹岚的声音隔着钢板已听不真切——他们焊死了竖井，既防丧尸追下来，也断了你的退路。身后无路，只能一路向前。");
          } else {
            WK.toast("回头路已经封死了，只能向前", "gold");
          }
          return;
        }
      }
    }
    // 豆包N12：正式模式下锁按剧情旗标放行；漫游模式（FREE_ROAM）一律放行
    if (info.lock && !WK.FREE_ROAM && !WK.lockOpen(info.lock, WK.P)) {
      WK.toast("门被锁住了", "bad");
      WK.log("danger", "（" + WK.LOCKS[info.lock] + "）");
      return;
    }
    if (info.lock && WK.FREE_ROAM && !WK.lockOpen(info.lock, WK.P)) {
      WK.toast("【锁·N3漫游放行】", "gold");
      WK.log("sys", "（此路在正式剧情中锁定：" + WK.LOCKS[info.lock] + "；N3 漫游模式已放行）");
    }

    // 豆包v116：移动时自动收束「不锁路」的旁白金句（lock:false）。
    // 否则玩家带着没关的非锁定旁白一路冲，EVT.check 会因 cur.active 吞掉后续
    // lock:true 关键事件（如下楼 s31 爆炸、抵达底层 n10_bottom），造成 stage 不推进。
    if (WK.EVT && WK.EVT.cur && WK.EVT.cur.active && !WK.EVT.cur.lock && !WK.EVT.cur.suspended) {
      WK.EVT.finish();
    }

    // 豆包v123：离开当前格前，若该格有尚未结算的「苦战营救」（点了离开/没救就走），被拖住的 NPC 当场死亡
    if (WK.rescue) WK.rescue.handleLeave(p.location);

    p._lastDir = d;
    p.location = info.to;
    if (WK.party) WK.party.follow(info.to); // 豆包N7：队友跟随
    const first = !p.visitedRooms[info.to];
    p.visitedRooms[info.to] = true;
    WK.save.write();
    WK.renderScene();
    const t = WK.ROOMS[info.to];
    WK.log(first ? "sys" : "sys", (first ? "你进入了「" : "你回到「") + t.name + (first ? "」。" : "」。"));
    window.scrollTo(0, 0);
    const ma = document.getElementById("main-area"); if (ma) ma.scrollTop = 0;
    if (WK.STORY10) WK.STORY10.onPlayerMove(d); // 豆包v116：大部队行进/锚点距离（楼层差实时算）
    if (WK.EVT) WK.EVT.check("enter"); // 豆包N9：进房触发剧情事件
  };

  /* 豆包N3：测试/系统用——直接传送（不触发移动动画与锁） */
  WK.teleport = function (roomId, silent) {
    if (!WK.ROOMS[roomId]) return;
    WK.P.location = roomId;
    if (WK.party) WK.party.follow(roomId); // 豆包N7：队友跟随
    WK.P.visitedRooms[roomId] = true;
    WK.save.write();
    WK.renderScene();
    if (!silent) WK.log("sys", "【传送】" + WK.ROOMS[roomId].name);
  };

  /* ============================================================
   * 豆包N3：全屏区域小地图（压缩坐标网格 + SVG 连线 + ？？？）
   * ============================================================ */
  WK.openZoneMap = function () {
    WK.assertLocation();
    const p = WK.P;
    const curId = p.location;
    const zoneId = WK.ROOMS[curId].zone;
    const z = WK.zoneMeta(zoneId);
    // 豆包v126：所有区域一律只渲染「已探索 + 当前」地块，未抵达的房间根本不进坐标集——
    // 网格规模即已探索规模，玩家无法靠小地图预知本区还有多少格 / 楼梯井还有多少层。
    let ids = Object.keys(WK.MAP).filter(id =>
      WK.ROOMS[id] && WK.ROOMS[id].zone === zoneId && (p.visitedRooms[id] || id === curId));

    const xs = [...new Set(ids.map(id => WK.MAP[id][0]))].sort((a,b)=>a-b);
    const ys = [...new Set(ids.map(id => WK.MAP[id][1]))].sort((a,b)=>a-b);
    const xRank = {}, yRank = {};
    xs.forEach((v,i)=>xRank[v]=i); ys.forEach((v,i)=>yRank[v]=i);
    const cols = xs.length, rows = ys.length;
    const CW = 92, CH = 58, TW = 82, TH = 40;
    const by = {};
    ids.forEach(id => { const c = WK.MAP[id]; by[c[0]+","+c[1]] = id; });

    let h = '<div class="minimap-head">' + z.name +
      '　<span class="mh-sub">' + z.sub + "</span></div>";
    h += '<div id="wk-map-scroll"><div class="minimap-grid" style="grid-template-columns:repeat(' + cols + "," + CW +
      'px);grid-auto-rows:' + CH + 'px;">';
    // 连线（仅同区；单向传送门画虚线）
    h += '<svg class="minimap-lines" style="width:' + (cols*CW) + "px;height:" + (rows*CH) + 'px;">';
    ids.forEach(id => {
      const exits = WK.ROOMS[id].exits || {};
      Object.keys(exits).forEach(d => {
        const info = WK.exitInfo(exits[d]);
        if (!info) return;
        const tid = info.to;
        if (!WK.MAP[tid] || WK.ROOMS[tid].zone !== zoneId) return; // 跨区不画
        const [x1,y1] = WK.MAP[id], [x2,y2] = WK.MAP[tid];
        const px1 = xRank[x1]*CW + CW/2, px2 = xRank[x2]*CW + CW/2;
        const py1 = (rows-1-yRank[y1])*CH + CH/2, py2 = (rows-1-yRank[y2])*CH + CH/2;
        h += '<line x1="'+px1+'" y1="'+py1+'" x2="'+px2+'" y2="'+py2+'" stroke="#3f544d" stroke-width="1.4"'+
             (info.lock === "teleport" ? ' stroke-dasharray="4 3" stroke="#8a7a3a"' : "") + '/>';
      });
    });
    h += "</svg>";
    // 地块（y 大=北，屏幕从上往下按 rows-1-y）
    for (let yi = rows-1; yi >= 0; yi--) {
      for (let xi = 0; xi < cols; xi++) {
        const id = by[xs[xi]+","+ys[yi]];
        if (!id) { h += '<div class="mm-cell"></div>'; continue; }
        const known = !!p.visitedRooms[id] || id === curId;
        const isCur = id === curId;
        const nm = known ? WK.roomShort(id) : "？？？";
        const cls = "mm-node" + (isCur ? " cur" : known ? "" : " unknown");
        // 豆包N14：小地图只作查看，节点永不可点击传送（避免预知/跳关未来场景）
        h += '<div class="mm-cell"><div class="' + cls + '" title="' + (known ? "已探索" : "尚未探索") + '">' + nm + "</div></div>";
      }
    }
    h += "</div></div>";
    h += '<div class="minimap-legend"><span class="lg cur"></span>当前位置　<span class="lg seen"></span>已探索' +
         '<span class="lg unk"></span>未探索　<span class="lg dash"></span>单向传送</div>';
    // 豆包N14：跨区跳转芯片已删除（正式版不能靠小地图跳到未到区域）
    h += '<button class="here-btn" style="width:100%;margin-top:10px;" onclick="WK.ui.closeOverlay(\'ov-map\')">关闭</button>';

    document.getElementById("map-body").innerHTML = h;
    document.getElementById("ov-map").classList.add("active");
    // 自动滚到当前房间
    setTimeout(() => {
      const sc = document.getElementById("wk-map-scroll");
      if (!sc || !WK.MAP[curId]) return;
      const [cx,cy] = WK.MAP[curId];
      sc.scrollLeft = Math.max(0, xRank[cx]*CW + CW/2 - sc.clientWidth/2);
      sc.scrollTop  = Math.max(0, (rows-1-yRank[cy])*CH + CH/2 - sc.clientHeight/2);
    }, 0);
  };

  /* 豆包N14：teleportToZone（小地图跨区跳转）已随传送功能一并删除 */

  /* 豆包N2：顶栏手表实时显示（倒计时 / 锚点距离 / 点数） */
  WK.renderWatchHUD = function () {
    const p = WK.P;
    const el = document.getElementById("nav-watch");
    if (!p || !el) return;
    const w = p.watch;
    // 豆包v124：三小时存活倒计时在下到蜂房底层后才启动。下楼段(stage2)顶栏改显「距马修距离」，
    // 列车/站台(stage0/1)倒计时未开始，只显示点数。
    if (!w.running && !w.ended) {
      if (p.stage === 2 && p.anchor.active) {
        const d = Math.round(p.anchor.distance || 0);
        const warn = d >= 80;
        el.innerHTML = '距' + p.anchor.name + ' <span style="color:' + (warn ? "#ff5a4d" : "var(--cyan)") + ';' +
          (warn ? 'font-weight:bold;animation:blink 1s steps(2) infinite;' : "") + 'font-family:ui-monospace,Menlo,monospace;">' +
          d + "m</span>　<span style=\"color:var(--god)\">" + p.points + "</span>";
      } else {
        el.innerHTML = '手表 --:--　<span style="color:var(--god)">' + p.points + "</span>";
      }
      return;
    }
    // 豆包N2：顶栏从简——常驻「倒计时 · 点数」；锚点平时在手表面板查看，
    // 距离超过 80 米进入危险区才在顶栏红字闪烁预警，避免信息挤行。
    let html = "手表 " + fmtMS(WK.rules.remainMs()) + '　<span style="color:var(--god)">' + p.points + "</span>";
    if (p.anchor.active && p.anchor.distance >= 80)
      html += '　<span class="warn">距' + p.anchor.name + " " + p.anchor.distance + "m!</span>";
    el.innerHTML = html;
  };

  /* 豆包N2：返回标题屏（抹杀后 / N2测试结算后；N13 起结算改为进主神空间） */
  WK.ui.backToTitle = function () {
    if (WK.P && WK.P.watch.running) WK.rules.stopWatch();
    WK.ui.closeAll();
    document.getElementById("intro").style.display = "flex";
    if (WK.catalogInstall) WK.catalogInstall();
  WK.ui.refreshIntro();
  };

  /* 豆包N2：存活结算窗（临时版；N13 替换为正式主神空间场景与逐笔结算页） */
  WK.ui.showSettle = function () {
    const p = WK.P;
    const rows = p.ledger.slice(-12).map(x =>
      '<div class="stat-row"><span class="k">' + (x.reason || "—") + '</span>' +
      '<span style="color:' + (x.n >= 0 ? "var(--green)" : "var(--red)") + '">' +
      (x.n >= 0 ? "+" : "") + x.n + "</span></div>").join("");
    WK.ui.generic("恐怖片结束 · 测试结算",
      '<div style="text-align:center;color:var(--god);font-size:15px;margin-bottom:8px;">你活下来了</div>' +
      '<div class="stat-sec">点数流水（近 12 笔）</div>' + rows +
      '<div class="stat-row" style="margin-top:8px;"><span class="k">最终点数</span>' +
      '<span style="color:var(--god);font-size:16px;">' + p.points + "</span></div>" +
      '<div style="margin-top:14px;"><button class="here-btn primary" style="width:100%;padding:12px;" onclick="WK.ui.backToTitle()">返回标题（N13 起改为进入主神空间）</button></div>');
  };

  /* ============================================================
   * 七、人物面板（属性 / 背包 / 技能）
   * ============================================================ */
  const ATTR_LABELS = [
    ["int", "智力"], ["spi", "精神力"], ["cel", "细胞活力"],
    ["ner", "神经反应速度"], ["mus", "肌肉组织强度"], ["imm", "免疫力强度"]
  ];

  WK.ui.openStatus = function (tab) {
    document.getElementById("ov-status").classList.add("active");
    WK.ui.switchStatusTab(tab || "attr");
  };

  // 豆包v142：背包内三分类切换（剧情道具/装备/道具）
  WK.ui.switchBagTab = function (bind) {
    WK.ui._bagTab = bind;
    WK.ui.switchStatusTab("bag");
  };

  WK.ui.switchStatusTab = function (tab) {
    ["attr", "equip", "bag", "skill", "blood"].forEach(t => {
      const el = document.getElementById("stab-" + t);
      if (el) el.classList.toggle("active", t === tab);
    });
    const p = WK.P;
    const body = document.getElementById("status-body");
    if (!p) { body.innerHTML = '<div class="empty-tip">暂无角色数据。</div>'; return; }

    if (tab === "attr") {
      let h = '<div class="stat-sec">基础</div>';
      h += row("姓名", p.name);
      h += row("生命", p.hp + " / " + p.maxHp);
      h += row("体力", p.res.stamina + " / " + p.res.maxStamina);
      // 豆包v128：基因锁 / T 病毒状态
      h += row("基因锁", p.flags.geneLockWeak
        ? '<span style="color:var(--gold)">一阶 · 弱化（药物捷径）</span>'
        : "未开启");
      if (p.flags.tVirusPrimed) h += row("T 病毒", '<span style="color:#e07060;">原液暴走中，急需血清</span>');
      else if (p.flags.infected) h += row("T 病毒", '<span style="color:#e07060;">已感染，尽快解毒</span>');
      h += '<div class="stat-sec">主神账本</div>';
      h += row("奖励点数", '<span style="color:var(--god)">' + p.points + "</span>");
      const bc = ["S","A","B","C","D"].map(k => k + "级 " + p.branch[k]).join("　");
      h += row("支线剧情", bc);
      h += '<div class="stat-sec">六维属性（普通人均值 100）</div><div class="attr-grid">';
      ATTR_LABELS.forEach(([k, label]) => { h += row(label, p.attrs[k]); });
      h += "</div>";
      h += '<div class="stat-sec">本集战绩</div>';
      h += row("击杀丧尸", p.kills.zombie);
      h += row("击杀丧尸犬", p.kills.dog||0);
      h += row("击杀爬行者", p.kills.crawler);
      body.innerHTML = h;
    }

    if (tab === "equip") {
      // 豆包v143：装备面板——四槽 + 当前战斗派生属性 + 背包中可装备列表
      const eq = p.equip || { weapon:null, armor:null, accessory:null, ring:null };
      const cs = WK.combat ? WK.combat.stats() : { atk:14, hit:0.05, crit:0.05, armor:0, kind:"unarmed", wepName:"徒手", chargeMs:3200 };
      const SLOTS = [
        { key:"weapon", name:"武器" },
        { key:"armor", name:"防具" },
        { key:"accessory", name:"饰品" },
        { key:"ring", name:"空间/戒指" }
      ];
      let h = '<div class="stat-sec">战斗派生（六维 + 装备 + 血统 · 全员同一公式）</div>';
      h += row("当前武器", (cs.wepName||"徒手") + " · " + ({ranged:"远程",melee:"近战",bow:"弓",unarmed:"徒手"}[cs.kind]||cs.kind) + (cs.naring ? ' <span style="color:#d8b06a;font-size:11px;">（纳戒裹能 · 普攻可伤灵体）</span>' : ""));
      if (cs.kind==="ranged"||cs.kind==="bow")
        h += row("伤害区间", (cs.dmgMin||"?") + " – " + (cs.dmgMax||"?") + "（素质越高越贴近上限）");
      else
        h += row("基础攻击", cs.baseAtk != null ? cs.baseAtk : cs.atk);
      h += row("命中加成", Math.round((cs.hit||0)*100) + "%");
      h += row("暴击加成", Math.round((cs.crit||0)*100) + "%");
      h += row("护甲减伤", cs.armor || 0);
      h += row("集气周期", Math.round((cs.chargeMs||3200)/100)/10 + " 秒满");
      // 豆包v173：血统/能量区改为统一面板（含每个血统槽的能量条、特质、授技、六维；空时给凡人提示）
      h += '<div class="stat-sec">血统 / 能量</div>';
      h += (WK.Blood ? WK.Blood.panelHtml() : '<div style="font-size:12px;color:var(--dim2);">血统系统未就绪</div>');
      h += '<div class="stat-sec">装备槽</div>';
      SLOTS.forEach(sl => {
        const id = eq[sl.key];
        const d = id ? WK.ITEM_DEF[id] : null;
        h += '<div class="bag-item" style="flex-direction:column;align-items:stretch;gap:6px;">';
        h += '<div style="display:flex;justify-content:space-between;"><span style="color:var(--dim);">'+sl.name+'</span>';
        if (d) {
          h += '<span style="color:var(--gold);">'+d.name+'</span></div>';
          const st = d.stats || {};
          const bits = [];
          if (st.atk) bits.push("攻击 +"+st.atk);
          if (st.hit) bits.push("命中 +"+Math.round(st.hit*100)+"%");
          if (st.crit) bits.push("暴击 +"+Math.round(st.crit*100)+"%");
          if (st.armor) bits.push("护甲 +"+st.armor);
          if (st.maxHp) bits.push("生命上限 +"+st.maxHp);
          h += '<div style="font-size:11.5px;color:var(--dim);">'+((bits.join(" · ")) || (d.desc||"").slice(0,60))+'</div>';
          h += '<button class="here-btn ghost" style="padding:7px;" onclick="WK.combat.unwear(\''+sl.key+'\');WK.ui.switchStatusTab(\'equip\')">卸下</button>';
        } else {
          h += '<span style="color:var(--dim2);">空</span></div>';
          h += '<div style="font-size:11px;color:var(--dim2);">在下方列表或背包「装备」页中选择装备</div>';
        }
        h += '</div>';
      });
      // 背包中可装备且未装上的
      const wearables = Object.keys(p.items||{}).filter(id => {
        if (!(p.items[id]>0)) return false;
        const slot = WK.combat.slotOf(id);
        if (!slot) return false;
        return eq[slot] !== id;
      });
      h += '<div class="stat-sec">可装备（来自背包）</div>';
      if (!wearables.length) {
        h += '<div class="empty-tip">没有可换上的装备。<br>主神「科技类 / 辅助类」兑换武器防具后会出现在这里。</div>';
      } else {
        wearables.forEach(id => {
          const d = WK.ITEM_DEF[id];
          const st = d.stats || {};
          const bits = [];
          if (st.atk) bits.push("攻+"+st.atk);
          if (st.armor) bits.push("甲+"+st.armor);
          if (st.hit) bits.push("命中+"+Math.round(st.hit*100)+"%");
          h += '<div class="bag-item"><span style="color:#d8c890;">'+d.name+(bits.length?(" · "+bits.join(" ")):"")+'</span>'+
            '<button class="here-btn primary" style="padding:6px 12px;" onclick="WK.combat.wear(\''+id+'\');WK.ui.switchStatusTab(\'equip\')">装备</button></div>';
        });
      }
      body.innerHTML = h;
    }

    if (tab === "bag") {
      // 豆包v142：背包三分类（剧情道具 / 装备 / 道具），共享同一个随身容量；分类只是筛选视图。
      const it = p.items || {};
      if (!WK.ui._bagTab) WK.ui._bagTab = "world";
      let h = "";
      if (p.flags.tVirusPrimed) {
        h += '<div style="border:1px solid #8a4a3a;background:rgba(190,90,60,.12);border-radius:10px;padding:11px;margin-bottom:12px;font-size:12.5px;line-height:1.7;color:#e8b0a0;">T 病毒正在体内暴走！<b>立刻使用一支抗病毒血清收束</b>，否则将被病毒吞噬。</div>';
      }
      // 容量条（三类共享 10 格 + 纳戒；只统计 bulk>0）
      const used = WK.inv.used(), cap = WK.inv.cap(), over = used > cap;
      h += '<div style="font-size:12px;color:var(--dim);display:flex;justify-content:space-between;margin-bottom:2px;">' +
        '<span>随身容量（三类共享；药剂 / 文件 / 钥匙 / 素材不占格）</span><span style="color:' + (over ? 'var(--red)' : 'var(--gold)') + ';">' + used + ' / ' + cap + '</span></div>' +
        '<div class="cap-bar' + (over ? ' over' : '') + '"><i style="width:' + Math.min(100, (cap ? used/cap*100 : 0)) + '%;"></i></div>';

      // —— 三分类切换条（带各自数量）——
      const CATS = [
        { key:"world", name:"剧情道具", note:"本世界搜到的门禁卡、情报、制式武器与医疗品——<b style='color:#e0a0a0;'>不可带出本世界</b>，回归主神时会被收缴。" },
        { key:"equip", name:"装备",     note:"主神兑换的武器与防具，可随你进入每一部恐怖片（本集仅有纳戒）。" },
        { key:"item",  name:"道具",     note:"可跨世界带走的兑换消耗品与特殊素材；贵重品 / T 病毒 / 红后核心请在主神「其他 → 本世界素材回收」兑换。" }
      ];
      h += '<div style="display:flex;gap:7px;margin:12px 0 4px;">' + CATS.map(c => {
        const n = WK.inv.idsByBind(c.key).reduce((s, id) => s + (it[id] || 0), 0);
        const on = WK.ui._bagTab === c.key;
        return '<button onclick="WK.ui.switchBagTab(\'' + c.key + '\')" style="flex:1;padding:9px 4px;border-radius:9px;font-size:13px;cursor:pointer;border:1px solid ' +
          (on ? "var(--gold)" : "var(--line)") + ';background:' + (on ? "rgba(216,200,144,.14)" : "transparent") +
          ';color:' + (on ? "var(--gold)" : "var(--dim)") + ';font-weight:' + (on ? "700" : "400") + ';">' + c.name +
          ' <span style="font-size:11px;opacity:.75;">' + n + '</span></button>';
      }).join("") + '</div>';
      const curCat = CATS.find(c => c.key === WK.ui._bagTab) || CATS[0];
      h += '<div style="font-size:11.5px;color:var(--dim2);line-height:1.7;margin:8px 0 10px;">' + curCat.note + '</div>';

      const USE_LABEL = { tvirus:"注射原液", antiviral:"注射血清", medspray:"使用 · 回血", bandage:"使用 · 止血", ration:"食用 · 回体力", ring_naring:"查看" };
      const renderItem = (id) => {
        const d = WK.ITEM_DEF[id], n = it[id];
        const isDanger = id === "tvirus", isDoc = d.kind === "doc", isVal = d.kind === "valuable", isMat = d.kind === "material";
        const bulkTag = d.bulk > 0 ? ('占 ' + (d.bulk*n) + ' 格') : '不占格';
        const dropBtn = WK.inv.canDrop(id)
          ? '<button class="here-btn ghost" style="flex:0 0 92px;padding:8px;" onclick="WK.inv.drop(\'' + id + '\',1)">丢弃 ×1</button>' : "";
        let battleBtn = "";
        const canBattle = d && (d.kind === "heal" || d.kind === "food" || d.kind === "throw" || d.kind === "battle" || d.heal || d.battleUse);
        if (canBattle) {
          const flags = WK.P.itemBattle || {};
          const active = flags[id] != null ? !!flags[id] : !!d.battleUse;
          battleBtn = '<button class="here-btn ' + (active ? "primary" : "ghost") + '" style="flex:0 0 100px;padding:8px;font-size:11px;" onclick="WK.inv.toggleBattleUse(\'' + id + '\')">' +
            (active ? "战斗中✓" : "设战斗用") + '</button>';
        }
        let mainBtn;
        if (isDoc) mainBtn = '<button class="here-btn primary" style="flex:1;padding:8px;" onclick="WK.inv.use(\'' + id + '\')">阅读</button>';
        else if (isVal) mainBtn = '<div style="flex:1;font-size:11px;color:#c8b07a;text-align:center;padding:8px;">主神「其他·素材回收」可兑换 <b style="color:var(--god)">'+d.value+'</b> 点/件</div>';
        else if (isMat) mainBtn = '<div style="flex:1;font-size:11px;color:#c8b07a;text-align:center;padding:8px;">主神「其他·素材回收」可兑换点数与支线剧情</div>';
        else if (USE_LABEL[id]) mainBtn = '<button class="here-btn ' + (isDanger ? "" : "primary") + '" style="flex:1;padding:8px;" onclick="WK.inv.use(\'' + id + '\')">' + USE_LABEL[id] + '</button>';
        else if (d.fun) mainBtn = '<button class="here-btn primary" style="flex:1;padding:8px;" onclick="WK.inv.use(\'' + id + '\')">' + (d.funKind === "cube" ? "折腾一下" : "使用") + '</button>';
        else if (d.auxItem) mainBtn = '<button class="here-btn primary" style="flex:1;padding:8px;" onclick="WK.inv.use(\'' + id + '\')">' + (d.kind === "revive" ? "濒死使用" : "使用") + '</button>';
        else if (d.bulk > 0) mainBtn = '<button class="here-btn primary" style="flex:1;padding:8px;" onclick="WK.inv.use(\'' + id + '\')">使用</button>';
        else mainBtn = '<div style="flex:1;font-size:11px;color:var(--dim2);text-align:center;padding:8px;">剧情道具 · 持有即生效，无法手动使用</div>';
        const color = isDanger ? "#e0a0a0" : (d.bulk>0 ? "#d8c890" : "#8fd0c0");
        // 剧情道具统一加「不可带出本世界」小标记
        const bindTag = curCat.key === "world"
          ? '<span style="font-size:10px;color:#e0a0a0;border:1px solid #6a3a34;border-radius:5px;padding:1px 5px;margin-left:6px;">不可带出本世界</span>' : "";
        return '<div class="bag-item" style="flex-direction:column;align-items:stretch;gap:7px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;">' +
            '<span style="color:' + color + ';">' + d.name + bindTag + '</span>' +
            '<span class="bi-count">×' + n + '　' + bulkTag + '</span></div>' +
          '<div style="font-size:11.5px;color:var(--dim);line-height:1.6;">' + d.desc.replace(/【不可带出本世界】/g,"") + '</div>' +
          '<div style="display:flex;gap:9px;">' + mainBtn + battleBtn + dropBtn + '</div>' +
        '</div>';
      };

      const ids = WK.inv.idsByBind(curCat.key);
      if (ids.length) {
        // 页内排序：不占格的关键/文件在前，占格消耗品在后
        ids.sort((a,b) => (WK.ITEM_DEF[a].bulk>0?1:0) - (WK.ITEM_DEF[b].bulk>0?1:0));
        ids.forEach(id => { h += renderItem(id); });
      } else {
        h += '<div style="color:var(--dim);padding:22px 0;text-align:center;line-height:1.9;">这一类现在还是空的。<br>' +
          (curCat.key === "world" ? "去蜂房里多翻翻箱子、柜子、尸体——门禁卡与物资都在场景里。"
           : curCat.key === "equip" ? "回到主神光球，在「科技类 / 辅助类」里兑换武器装备。"
           : "可兑换的消耗品与能跨世界带走的素材会出现在这里。") + '</div>';
      }
      body.innerHTML = h;
    }

    if (tab === "skill") {
      const owned = Object.keys(p.skills);
      if (!owned.length) {
        body.innerHTML =
          '<div class="empty-tip">尚未掌握任何技能。<br><br>' +
          '本集可用 <span style="color:var(--gold)">枪械战术</span> 技能（射击 / 爆头 / 翻滚 / 急救），' +
          '将在 N6 战斗系统中实装。<br><br>' +
          '主神空间可兑换：科技枪械、魔法传说、武功、辅助与机甲类能力——全书体系逐步开放。</div>';
      } else {
        body.innerHTML = owned.map(sn => {
          const s = p.skills[sn];
          return '<div class="bag-item"><span>' + sn + '</span><span class="bi-count">Lv.' + s.level + '</span></div>';
        }).join("");
      }
    }

    if (tab === "blood") {
      let h = '<div class="stat-sec">已写入的血统</div>';
      if (WK.Blood) h += WK.Blood.panelHtml();
      else h += '<div class="empty-tip">血统系统未加载。</div>';
      const ba = WK.Blood ? WK.Blood.totalAttrs(p) : {};
      const map = { mus:"肌肉组织强度", ner:"神经反应速度", int:"智力", spi:"精神力", cel:"细胞活力", imm:"免疫力强度" };
      const parts = Object.keys(map).filter(k => ba[k]).map(k => map[k] + " +" + ba[k]);
      if (parts.length) {
        h += '<div class="stat-sec" style="margin-top:14px;">血统合计加成</div>';
        h += '<div style="font-size:13px;color:#c8d6c8;line-height:1.8;">' + parts.join("<br>") + '</div>';
      }
      body.innerHTML = h;
    }
  };

  function row(k, v) {
    return '<div class="stat-row"><span class="k">' + k + '</span><span>' + v + "</span></div>";
  }

  /* ============================================================
   * 八、主神手表 / 任务 / 系统（N1 均为静态占位，按钮全部可用）
   * ============================================================ */
  /* 豆包N2：主神手表——倒计时 / 锚点 / 点数 / 击杀全部实时 */
  /* ============================================================
   * 豆包v166：三档手动存读档面板（标题 ctx='title' 只能读/删；手表 ctx='watch' 可存/读/删）
   * ============================================================ */
  WK.ui._slotCN = ["", "一", "二", "三"];
  WK.ui._slotMetaLine = function (m) {
    if (m.broken) return '<span style="color:#e08090;">存档已损坏，无法读取，建议删除后重开。</span>';
    if (!m.exists) return '<span style="color:var(--dim2);">空槽 —— 还没有存档</span>';
    const stageName = (WK.rules && WK.rules.STAGE_NAMES && WK.rules.STAGE_NAMES[m.stage]) || ("阶段 " + m.stage);
    const roomName = (WK.ROOMS && WK.ROOMS[m.location] && WK.ROOMS[m.location].name) || "未知地点";
    const t = new Date(m.savedAt || Date.now()), pad = x => String(x).padStart(2, "0");
    const ts = (t.getMonth() + 1) + "/" + t.getDate() + " " + pad(t.getHours()) + ":" + pad(t.getMinutes());
    return '<b style="color:#d8c890;">' + (m.name || "无名") + '</b> <span style="color:var(--dim);">· ' +
      (m.dead ? '<span style="color:#e08090;">已倒下 · </span>' : '') + stageName + ' · ' + roomName + '</span><br>' +
      '<span style="font-size:11.5px;color:var(--dim2);">生命 ' + Math.round(m.hp) + " / " + m.maxHp + ' · ' + ts +
      (m.reborn ? ' · 重生者' : '') + '</span>';
  };
  WK.ui.openSaveManager = function (ctx) {
    ctx = ctx || "watch";
    // 战斗进行中禁止存读档，避免写入一场无法恢复的半截战斗
    if (ctx === 'watch' && WK.battle && WK.battle.state && WK.battle.state.active) {
      WK.toast("战斗中无法存档，先结束这场战斗", "bad"); return;
    }
    const cur = WK.save.slot;
    let h = '<div style="display:flex;flex-direction:column;gap:10px;margin-top:6px;">';
    WK.save.listSlots().forEach(m => {
      const isCur = (m.slot === cur && ctx === 'watch');
      h += '<div style="border:1px solid ' + (isCur ? 'var(--gold)' : 'var(--line2)') + ';border-radius:10px;padding:11px 12px;background:var(--panel3);">' +
        '<div style="font-weight:700;color:' + (isCur ? 'var(--gold)' : 'var(--txt)') + ';margin-bottom:6px;">存档槽 ' +
        WK.ui._slotCN[m.slot] + (isCur ? '（当前进度）' : '') + '</div>' +
        '<div style="font-size:12.5px;line-height:1.7;margin-bottom:9px;">' + WK.ui._slotMetaLine(m) + '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;">';
      if (ctx === 'watch')
        h += '<button class="here-btn primary" style="flex:1;min-width:78px;padding:9px;" onclick="WK.ui.askSaveTo(' + m.slot + ')">存入</button>';
      if (m.exists && !m.broken) {
        h += '<button class="here-btn" style="flex:1;min-width:78px;padding:9px;" onclick="WK.ui.askLoadFrom(' + m.slot + ',\'' + ctx + '\')">读取</button>';
        h += '<button class="here-btn ghost" style="flex:0 0 60px;padding:9px;" onclick="WK.ui.askDeleteSlot(' + m.slot + ',\'' + ctx + '\')">删除</button>';
      }
      h += '</div></div>';
    });
    h += '</div>';
    h += '<div style="font-size:11.5px;color:var(--dim2);line-height:1.7;margin:12px 2px 2px;">' +
      '三个存档槽互不覆盖，可随时手动存盘。战斗中无法打开此面板；死亡或选错时，回标题读取旧档即可重来。</div>' +
      '<button class="here-btn ghost" style="width:100%;margin-top:12px;padding:11px;" onclick="WK.ui.closeOverlay(\'ov-generic\')">关闭</button>';
    WK.ui.generic("存档 / 读档", h);
  };
  WK.ui.askSaveTo = function (slot) {
    const m = WK.save.peek(slot);
    const doSave = () => {
      WK.save.saveTo(slot);
      WK.ui.closeOverlay('ov-dialog');
      WK.toast("已存入存档槽 " + WK.ui._slotCN[slot], "gold");
      WK.ui.openSaveManager('watch');
    };
    if (m.exists) {
      WK.ui.dialog("覆盖存档槽 " + WK.ui._slotCN[slot] + "？",
        '<span class="sys">该槽已有 <b style="color:#d8c890;">' + (m.name || "无名") + '</span> 的进度（' +
        ((WK.rules.STAGE_NAMES || {})[m.stage] || ("阶段" + m.stage)) + '）。<br>存入将<b class="danger">覆盖且无法恢复</b>，确定吗？</span>',
        [ { text: "覆盖存入", danger: true, primary: true, act: doSave },
          { text: "取消", act: () => WK.ui.closeOverlay('ov-dialog') } ]);
    } else { doSave(); }
  };
  WK.ui.askLoadFrom = function (slot, ctx) {
    const m = WK.save.peek(slot);
    if (!m.exists || m.broken) { WK.toast("这个存档槽无法读取", "bad"); return; }
    const doLoad = () => { WK.ui.closeOverlay('ov-dialog'); WK.ui.closeOverlay('ov-generic'); WK.save.loadFrom(slot); };
    if (ctx === 'watch') {
      WK.ui.dialog("读取存档槽 " + WK.ui._slotCN[slot] + "？",
        '<span class="sys">将读取 <b style="color:#d8c890;">' + (m.name || "无名") + '</b> 的进度。<br>' +
        '当前尚未存入的进度会丢失（建议先在某个槽「存入」）。确定读取吗？</span>',
        [ { text: "读取", primary: true, act: doLoad },
          { text: "取消", act: () => WK.ui.closeOverlay('ov-dialog') } ]);
    } else { doLoad(); }
  };
  WK.ui.askDeleteSlot = function (slot, ctx) {
    WK.ui.dialog("删除存档槽 " + WK.ui._slotCN[slot] + "？",
      '<span class="danger">删除后该槽进度无法恢复。</span>',
      [ { text: "确认删除", danger: true, act: () => {
            WK.save.deleteSlot(slot); WK.ui.closeOverlay('ov-dialog');
            WK.toast("已删除存档槽 " + WK.ui._slotCN[slot], "gold");
            if (ctx === 'title' && !WK.save.anyExists()) { WK.ui.closeOverlay('ov-generic'); WK.ui.backToTitle(); }
            else WK.ui.openSaveManager(ctx);
          } },
        { text: "取消", act: () => WK.ui.closeOverlay('ov-dialog') } ]);
  };
  /* 新游戏起名后：选择从哪个槽开始（空槽直接开始，已有档需确认覆盖）*/
  WK.ui.chooseSlotForNew = function (name, reborn) {
    WK.ui.closeOverlay('ov-dialog');   // 关掉起名弹层，否则它(400)压在选槽面板(350)上
    let h = '<div style="font-size:12.5px;color:var(--dim);line-height:1.7;margin-bottom:10px;">选择一个存档槽开始新的旅程：</div>';
    h += '<div style="display:flex;flex-direction:column;gap:10px;">';
    WK.save.listSlots().forEach(m => {
      h += '<div style="border:1px solid var(--line2);border-radius:10px;padding:10px 12px;background:var(--panel3);">' +
        '<div style="font-weight:700;margin-bottom:5px;">存档槽 ' + WK.ui._slotCN[m.slot] + '</div>' +
        '<div style="font-size:12px;line-height:1.6;min-height:34px;">' + WK.ui._slotMetaLine(m) + '</div>' +
        '<button class="here-btn ' + (m.exists ? "" : "primary") + '" style="width:100%;margin-top:7px;padding:9px;" ' +
        'onclick="WK.ui.askStartInSlot(' + m.slot + ')">' + (m.exists ? "覆盖并在此开始" : "在此开始") + '</button></div>';
    });
    h += '</div><button class="here-btn ghost" style="width:100%;margin-top:12px;padding:10px;" onclick="WK.ui.closeOverlay(\'ov-generic\')">返回</button>';
    WK.ui.generic("选择存档槽", h);
    WK.ui._pendingNew = { name: name, reborn: !!reborn };
  };
  WK.ui.askStartInSlot = function (slot) {
    const m = WK.save.peek(slot), pend = WK.ui._pendingNew || { name: "无名", reborn: false };
    const go = () => { WK.ui.closeOverlay('ov-dialog'); WK.ui.closeOverlay('ov-generic'); WK.startGame(pend.name, pend.reborn, slot); };
    if (m.exists) {
      WK.ui.dialog("覆盖存档槽 " + WK.ui._slotCN[slot] + "？",
        '<span class="sys">该槽已有 <b style="color:#d8c890;">' + (m.name || "无名") + '</b> 的进度，开始新游戏将<b class="danger">覆盖它</b>。</span>',
        [ { text: "覆盖并开始", danger: true, primary: true, act: go },
          { text: "取消", act: () => WK.ui.closeOverlay('ov-dialog') } ]);
    } else { go(); }
  };

  WK.ui.openWatch = function () {
    const p = WK.P;
    const body = document.getElementById("watch-body");
    // 豆包v124：三小时倒计时在下到底层后才启动；未开始时面板明确标注「尚未开始」，不提前挂时间任务
    const notStarted = !p.watch.running && !p.watch.ended;
    body.innerHTML =
      '<div style="text-align:center;color:var(--dim);font-size:12px;margin-bottom:4px;">恐怖片世界</div>' +
      '<div style="text-align:center;font-size:19px;color:var(--god);margin-bottom:16px;letter-spacing:2px;">生化危机一 · 蜂房</div>' +
      '<div style="text-align:center;color:var(--dim);font-size:12px;">' + (notStarted ? "生存倒计时 · 尚未开始" : "存活倒计时") + "</div>" +
      '<div id="watch-r-time" style="text-align:center;font-size:34px;color:var(--red);font-family:ui-monospace,Menlo,monospace;margin:4px 0 6px;">--:--</div>' +
      '<div id="watch-r-anchor" style="text-align:center;color:var(--cyan);font-size:12px;min-height:18px;margin-bottom:10px;"></div>' +
      (notStarted ? '<div style="text-align:center;color:var(--gold);font-size:11px;line-height:1.7;margin-bottom:10px;">当前阶段：' +
        (p.stage === 2 ? "跟随马修小队下楼，盯紧与他的距离" : "跟随马修小队，前往蜂房") + "<br>下到蜂房底层后，三小时倒计时才开始</div>" : "") +
      '<div style="text-align:center;color:var(--dim);font-size:12px;">奖励点数</div>' +
      '<div id="watch-r-points" style="text-align:center;font-size:24px;color:var(--god);margin-bottom:18px;">' + p.points + '</div>' +
      '<div class="stat-sec">存档</div>' +
      '<button class="here-btn primary" style="width:100%;margin:4px 0 4px;padding:11px;" ' +
        'onclick="WK.ui.closeOverlay(\'ov-watch\');setTimeout(function(){WK.ui.openSaveManager(\'watch\');},80)">存档 / 读档（共三槽）</button>' +
      '<div style="font-size:11px;color:var(--dim);line-height:1.6;margin:0 0 14px;">三个手动存档槽，互不覆盖；死亡或走错路可回标题读取旧档。战斗中无法存档。</div>' +
      '<div class="stat-sec">区域地形图</div>' +
      '<button class="here-btn" style="width:100%;margin:4px 0 16px;padding:10px;" ' +
        'onclick="WK.ui.closeOverlay(\'ov-watch\');setTimeout(function(){WK.openZoneMap();},80)">查看本区地形图</button>' +
      '<div style="font-size:11px;color:var(--dim);line-height:1.6;margin:-8px 0 14px;">只显示你已探明的地块；楼梯井下看不到尚未抵达的楼层。</div>' +
      '<div class="stat-sec">手表记录</div>' +
      row("歼灭丧尸", p.kills.zombie + " 只 / 已折 " + p.kills.zombiePaid + " 点（一场群战约 " + WK.RULES.zombiePerPoint + " 只）") +
      row("歼灭丧尸犬", (p.kills.dog||0) + " 只 / 已折 " + (p.kills.dogPaid||0) + " 点（极速犬群，成群计点）") +
      row("击杀爬行者", p.kills.crawler + "（每只 " + WK.RULES.crawlerPoint + " 点）") +
      row("杀害新人", p.kills.rookie + "（每名 " + WK.RULES.rookiePoint + " 点）") +
      '<div class="stat-sec">规则</div>' +
      row("存活时长", notStarted ? "下到蜂房底层后启动，共 " + Math.round(WK.RULES.watchMinutes / 60) + " 小时" : Math.round(WK.RULES.watchMinutes / 60) + " 小时") +
      row("锚点距离", "离开锚点人物 " + WK.RULES.anchorLimit + " 米抹杀") +
      row("脱战恢复", "不战斗时每秒恢复 " + Math.round(WK.RULES.hpRegenPerSec * 100) + "% 生命，战斗中不恢复") +
      row("禁忌话题", "剧情人物面前提主神/奖励点，每句 " + WK.RULES.swearPenalty + " 点") +
      row("丧尸计分", "每 " + WK.RULES.zombiePerPoint + " 只 1 点，群战清场统一折算") +
      row("存活奖励", WK.RULES.baseReward + " 点；结束时负分抹杀");
    document.getElementById("ov-watch").classList.add("active");
    WK.ui.refreshWatchLive();
  };

  /* 豆包N2：手表面板打开时的高频刷新（只改动态节点，不重建结构） */
  WK.ui.refreshWatchLive = function () {
    const p = WK.P;
    if (!p || !document.getElementById("ov-watch").classList.contains("active")) return;
    const t = document.getElementById("watch-r-time");
    if (t) {
      const w = p.watch;
      t.textContent = (w.running || w.ended) ? fmtMS(WK.rules.remainMs()) : "--:--";
      t.style.color = (w.running || w.ended) ? "var(--red)" : "var(--dim2)";
    }
    const a = document.getElementById("watch-r-anchor");
    if (a) a.textContent = p.anchor.active
      ? "锚点：" + p.anchor.name + "　当前距离 " + p.anchor.distance + "m"
      : (p.watch.ended ? "锚点规则已解除" : "锚点人物尚未出现");
    const pt = document.getElementById("watch-r-points");
    if (pt) pt.textContent = p.points;
  };

  /* 豆包N2：任务面板——主线 / 先知支线 真实列表 */
  WK.ui.openTasks = function () {
    const p = WK.P;
    const list = (type, title) => {
      const qs = p.quests.filter(q => q.type === type);
      if (!qs.length) return "";
      let h = '<div class="stat-sec">' + title + "</div>";
      qs.forEach(q => {
        const tag = q.state === "done" ? '<span style="color:var(--green)">已完成</span>'
          : q.state === "failed" ? '<span style="color:var(--red)">已失败</span>'
          : '<span style="color:var(--gold)">进行中</span>';
        h += '<div class="bag-item"><span>' + q.title + "</span><span class='bi-count'>" + tag + "</span></div>";
      });
      return h;
    };
    const content = list("main", "主线") + list("side", "先知支线（记忆闪回）");
    WK.ui.generic("任务",
      content ||
      '<div class="empty-tip">当前没有任务。<br><br>' +
      '「记忆闪回」——你看过这部电影，关键时刻手表震动、脑内预知剧情走向，' +
      '可据此接取先知支线（楼梯拉詹岚、激光通道喊提示、保护雷恩……）。<br>' +
      '正式任务将在 N9 事件管道、N10 起剧情中出现。</div>');
  };

  /* ============================================================
   * 豆包v120：beta 测试工具（lon 要求保留到正式发布前；正式版整块删除 + 移除面板入口）
   * 用于快速验证「下楼四选一搀扶 / s31 死活分支 / stage3 自我介绍」，不必每次从头走 50 层。
   * ============================================================ */
  WK.TEST = {
    /* 直接进入 s_42 四选一抉择：复位下楼段、复活小胖/妇女、马修锚点距离归零、大部队开始行进 */
    gotoStairChoice(){
      const p = WK.P; if (!p) return;
      if (WK.EVT.cur) WK.EVT.finish();
      WK.STORY10 && WK.STORY10.stopSquad && WK.STORY10.stopSquad();
      ["n10_s50","n10_s42","n10_s31","n10_bottom"].forEach(k => { delete p.evDone[k]; });
      ["fatty","woman"].forEach(id => { if (p.npcs[id]) p.npcs[id].alive = true; });
      p.flags._assistWho = null; p.flags._assistFloors = 0;
      p.flags._assistLag = 0; p.flags._restPending = false;
      p.flags._squadFloor = 42;
      p.stage = 2; WK.story.applyStage(2, { silent:true });
      if (!p.anchor.active) WK.rules.setAnchor("马修-艾迪森");
      WK.teleport("s_42", true);
      WK.STORY10.startSquad();
      WK.STORY10.syncSquadNpcs(); WK.STORY10.recalcAnchor();
      WK.ui.closeOverlay("ov-generic"); WK.renderScene();
      WK.EVT.check("enter");
    },
    /* 锚点无敌开关：开启后脱离马修 100 米也不抹杀，方便专注看救人/歇息弹窗 */
    toggleGod(){
      const p = WK.P; if (!p) return;
      p.flags._godTest = !p.flags._godTest; WK.save.write();
      WK.ui.closeOverlay("ov-generic"); WK.ui.openSystem();
    },
    /* 按当前 _assistWho 立刻播放 s_31 爆炸结算（没扶的人死、被扶的人活）*/
    fireS31(){ if (!WK.EVT.cur) { WK.ui.closeOverlay("ov-generic"); WK.EVT.run("n10_s31"); } },
    /* 直达注水研究区自我介绍（保留当前搀扶造成的死活结果）*/
    gotoLab(){
      const p = WK.P; if (!p) return;
      if (WK.EVT.cur) WK.EVT.finish();
      WK.STORY10 && WK.STORY10.stopSquad && WK.STORY10.stopSquad();
      p.flags._restPending = false; p.flags.labSearchWait = false;
      delete p.evDone["n11_lab"]; delete p.evDone["n11_lab_back"];
      p.stage = 3; WK.story.applyStage(3, { silent:true });
      WK.teleport("l_hall", true);
      WK.ui.closeOverlay("ov-generic"); WK.renderScene();
      WK.EVT.check("enter");
    },
    /* 满血满体力，避免测试途中被杂兵/流血干扰 */
    heal(){
      const p = WK.P; if (!p) return;
      p.hp = p.maxHp;
      if (p.res) { p.res.stamina = p.res.maxStamina || 60; }
      WK.save.write(); WK.renderScene && WK.renderScene();
      WK.toast("已回满状态", "gold");
    },
    /* 豆包v123：直达 B 线半空通道，触发 J.D. 苦战营救（帮助/离开 两分支都可在这测）*/
    gotoSewerRescue(){
      const p = WK.P; if (!p) return;
      if (WK.EVT.cur) WK.EVT.finish();
      WK.STORY10 && WK.STORY10.stopSquad && WK.STORY10.stopSquad();
      Object.assign(p.flags, { routeB:true, routeChosen:true, routeA:false, redqueenOff:true, shutdownDone:true });
      delete p.flags.rescueJd; delete p.flags._rescueActive; delete p.flags._bWalkwayResolved;
      ["n12_B_walkway","n12_B_jd_saved","n12_B_corpse","n12_B_station","n12_B_train"].forEach(k=>delete p.evDone[k]);
      const jd=WK.npcState("jd"); if(jd){ jd.alive=true; jd.struggle=false; }
      p.stage=9; WK.story.goToStage(9,{silent:true});
      WK.EVT.fnLib.n12BSquadDown && WK.EVT.fnLib.n12BSquadDown();
      WK.teleport("sw_walkway", true);
      WK.ui.closeOverlay("ov-generic"); WK.renderScene();
      WK.EVT.check("enter");
    },

    /* ===== 豆包v141 N22：探索包章节直达（仅 beta 测试，正式发布随测试面板整块删除）=====
       目的：N15–N22 铺的搜刮/锁门/犬舍/宿舍/贵重品/主神兑换内容很深，从头打要数小时，
       这组方法让 lon 一键跳到任意新区域做实测。所有方法都先结束在播剧情、停下楼大部队，
       再把旗标拨到对应状态，避免和正常流程的 lock 事件打架。*/

    /* 一键配齐测试资源：三张权限卡 + 纳戒(+30容量) + 战斗补给 + 三件贵重品 + 500 奖励点，并回满状态 */
    kit(){
      const p = WK.P; if (!p) return;
      ["keycard_l1","keycard_l2","keycard_l3","ring_naring",
       "tvirus","antiviral","core_redqueen" ]   // 豆包v142：三种特殊素材，测「其他·素材回收」一次性兑换（点+支线）
        .forEach(id => WK.inv.add(id, 1));
      [["medspray",3],["bandage",3],["ration",3],["frag",2],
       ["val_watch",1],["val_jewelry",1],["val_data",1]]
        .forEach(([id,n]) => WK.inv.add(id, n));
      WK.rules.addPoints(500, "测试资源包");
      this.heal();
      WK.ui.closeOverlay("ov-generic");
      WK.toast("测试包已发：三卡 / 纳戒 / 补给 / 三贵重品 / 三特殊素材 / 500 点", "gold");
    },
    /* 统一备场：进入「红后已关、门全开、可自由搜刮」的选路前状态（不预置 A/B，地上各区随便走）。
       手动置 stage/flags，不走 story.goToStage——后者会按主动线搬一堆 NPC，纯搜刮用不到。*/
    _prepFree(){
      const p = WK.P; if (!p) return;
      if (WK.EVT && WK.EVT.cur){ try { WK.EVT.finish(); } catch(e){} }
      WK.STORY10 && WK.STORY10.stopSquad && WK.STORY10.stopSquad();
      p.flags._restPending = false; p.flags.labSearchWait = false;
      Object.assign(p.flags, { redqueenOff:true, shutdownDone:true, routeChosen:false, routeA:false, routeB:false,
        _bBackSealed:false, _bDither1:false });
      p.stage = 7;
      WK.ui.closeOverlay("ov-generic");
    },
    /* 落地到某搜刮房；withSquad=true 时把张杰搬到同格（B餐厅集装箱靠他触发「别手欠」警告）*/
    _land(room, withSquad){
      this._prepFree();
      if (withSquad){ const z = WK.npcState("zhangjie"); if (z){ z.alive = true; z.loc = room; } }
      WK.teleport(room, true);
      WK.renderScene && WK.renderScene();
      if (WK.EVT) WK.EVT.check("enter");
    },
    /* 选路窗口：关红后、全队集结主机房，看「最后搜刮窗口」提示并实测 A/B 抉择 */
    gotoRouteChoice(){
      this.kit(); this._prepFree();
      // n11_shutdown（关红后）是 once 且只看 stage===7、注册在 n12_choice 之前——手动跳到选路态时
      // 必须把它标记为已完成，否则一进主机房会先补播关红后，n12_choice 被它顶掉。
      WK.P.evDone["n11_shutdown"] = true;
      delete WK.P.evDone["n12_choice"];
      WK.teleport("core_room", true); WK.renderScene(); WK.EVT.check("enter");
    },
    gotoWarehouse(){ this._land("d_containers", true); },   // B餐厅集装箱群（34箱/开箱概率爬行者）
    gotoSecurity(){ this.kit(); this._land("l_sec_a"); },   // 安保监控间：三卡权限链/保险库/BOW样本库
    gotoKennel(){ this._land("k_entry"); },                 // 犬舍入口（kennel gate=redqueenOff）
    gotoDorm(){ this._land("dorm_hall"); },                 // 员工宿舍区
    /* 豆包v166：A 线拆两段。此键直达「雇佣兵已撤、自由搜刮期」，人在主机房——
       可折返搜刮 / 测存档，回主机房点张杰即触发死守最终战。*/
    gotoFinalA(){
      this.kit();
      const p = WK.P;
      if (WK.EVT && WK.EVT.cur){ try { WK.EVT.finish(); } catch(e){} }
      Object.assign(p.flags, { redqueenOff:true, shutdownDone:true,
        routeChosen:true, routeA:true, routeB:false,
        routeAFreeExplore:true, aFinalTriggered:false, returned:false });
      p.evDone["n12_A"] = true;
      delete p.evDone["n12_A_final"];
      p.stage = 8;
      WK.STORY12.moveAlive("core_sewer", WK.STORY12.MOVIE, true);     // 雇佣兵已下井
      WK.STORY12.moveAlive("core_room", WK.STORY12.REINC_STAY, true); // 张杰等留守主机房
      WK.teleport("core_room", true); WK.renderScene();
    },
    /* 跳过自由期对话，立刻进爬行者最终战，专测「战胜 / 战败都立即回归主神」*/
    gotoAFinalNow(){
      this.gotoFinalA();
      WK.EVT.run("n12_A_final");
    },
    /* 主神空间：落在光球、直接开「回收」页（可切到属性/科技/辅助/魔法/武功/机甲各系看锁定展示）*/
    gotoGodSpace(){
      this.kit();
      // 确保P.npcs存在（旧存档可能没有）
      if (!WK.P.npcs) WK.P.npcs = {};
      // 确保新增NPC存在于P.npcs（旧存档可能没有）
      const npcs = WK.P.npcs;
      ["luoli","naer","lixiaoyi"].forEach(id => {
        if (!npcs[id] && WK.NPCS[id]) npcs[id] = { loc: WK.NPCS[id].home, alive: true, met: false };
      });
      // 生化一活下来的NPC都在各自房间
      if (npcs.zhangjie) { npcs.zhangjie.loc = "g_room_zhang"; npcs.zhangjie.alive = true; }
      if (npcs.zhengzha) { npcs.zhengzha.loc = "g_room_zheng"; npcs.zhengzha.alive = true; }
      if (npcs.zhanlan) { npcs.zhanlan.loc = "g_room_zhan"; npcs.zhanlan.alive = true; }
      if (npcs.luoli) { npcs.luoli.loc = "g_room_zheng"; npcs.luoli.alive = true; }
      if (npcs.naer) { npcs.naer.loc = "g_room_zhang"; npcs.naer.alive = true; }
      if (npcs.lixiaoyi) { npcs.lixiaoyi.loc = "g_room_lixiao"; npcs.lixiaoyi.alive = true; }
      WK.teleport("g_orb", true); WK.renderScene();
      WK.SHOP.open("other");
    },
    /* v202：回归主神空间·完整版——NPC都在各自房间，训练场开着，测房间对话 */
    goHomeFull(){
      this.kit();
      const p = WK.P;
      if (WK.EVT && WK.EVT.cur){ try { WK.EVT.finish(); } catch(e){} }
      // 第二天：训练场开放
      p.flags.train_open = true;
      // 确保P.npcs存在（旧存档可能没有）
      if (!p.npcs) p.npcs = {};
      // 确保新增NPC存在于P.npcs（旧存档可能没有）
      const npcs = p.npcs;
      ["luoli","naer","lixiaoyi"].forEach(id => {
        if (!npcs[id] && WK.NPCS[id]) npcs[id] = { loc: WK.NPCS[id].home, alive: true, met: false };
      });
      // 生化一活下来的NPC都在各自房间
      if (npcs.zhangjie) { npcs.zhangjie.loc = "g_room_zhang"; npcs.zhangjie.alive = true; }
      if (npcs.zhengzha) { npcs.zhengzha.loc = "g_room_zheng"; npcs.zhengzha.alive = true; }
      if (npcs.zhanlan) { npcs.zhanlan.loc = "g_room_zhan"; npcs.zhanlan.alive = true; }
      if (npcs.luoli) { npcs.luoli.loc = "g_room_zheng"; npcs.luoli.alive = true; }
      if (npcs.naer) { npcs.naer.loc = "g_room_zhang"; npcs.naer.alive = true; }
      if (npcs.lixiaoyi) { npcs.lixiaoyi.loc = "g_room_lixiao"; npcs.lixiaoyi.alive = true; }
      WK.teleport("g_arrive", true);
      WK.renderScene();
      WK.toast("已回归主神空间（第二天·训练场开放·西区房间可测）", "gold");
    },

    /* 豆包v167：鬼怪属性测试 —— 发枪并装备，给齐附魔+1/+6弹、灵类弹、神圣弹、神圣手雷、一次性恶意
       护身符，直接打一只【物理免疫的怨灵】。验证：普攻打不动、附魔/灵类/神圣/符咒能伤、按颗消耗。*/
    gotoGhost(){
      this.kit();
      const p = WK.P;
      const gunId = this._gunId();
      if (gunId){ WK.inv.add(gunId, 1); p.equip = p.equip || { weapon:null, armor:null, accessory:null, ring:null }; p.equip.weapon = gunId; }
      [["t_c15836203",6],["t_c38958746",3],["t_c92110272",8],["t_c18172022",4],["t_c9702526",1],["m_c29556997",2]]
        .forEach(([id,n]) => WK.inv.add(id, n));
      WK.save.write();
      WK.teleport("core_room", true); WK.renderScene();
      WK.ui.closeOverlay("ov-generic");
      WK.battle.start("core_room", { wave:[{ id:"wraith", count:1 }], noFlee:true });
    },
    _gunId(){
      const tech = ((WK.CATALOG && WK.CATALOG.tech) || []);
      const c = tech.find(x => x.kind === "gun" && x.wepType === "ranged");
      if (c && WK.ITEM_DEF[c.id]) return c.id;
      return Object.keys(WK.ITEM_DEF).find(id => { const d = WK.ITEM_DEF[id]; return d && (d.wepType === "ranged" || d.type === "firearm"); }) || null;
    }
  };

  /* 豆包N14：系统面板。正式信息（版本/存档/清档）＋ 豆包v120 临时测试工具区（发布前删）。 */
  WK.ui.openSystem = function () {
    const data = WK.save.read();
    const savedText = data ? new Date(data.savedAt).toLocaleString("zh-CN") : "无存档";
    const godOn = !!(WK.P && WK.P.flags && WK.P.flags._godTest);
    const rebornOn = !!(WK.P && WK.P.flags && WK.P.flags.reborn);
    const tbtn = (label, fn, primary) =>
      '<button class="here-btn ' + (primary ? "primary" : "") + '" style="width:100%;text-align:left;" onclick="' + fn + '">' + label + "</button>";
    WK.ui.generic("系统",
      '<div class="stat-sec">版本</div>' +
      row("构建", WK.VERSION + " · " + WK.STAGE) +
      row("最近存档", savedText) +
      '<div class="stat-sec" style="margin-top:16px;">剧情呈现</div>' +
      '<button class="here-btn ' + (rebornOn ? "primary" : "") + '" style="width:100%;text-align:left;" onclick="WK.ui.toggleReborn()">' +
        "剧情快进（我是重生者）：" + (rebornOn ? "已开启 · 对白快速带过、只停选项" : "关闭 · 逐句观看") + "</button>" +
      '<div style="font-size:11px;color:var(--dim);line-height:1.6;margin:7px 2px 0;">开启后，已看过的对白/旁白会快速滚过，只在需要你做选择或战斗时停下。</div>' +
      '<div style="margin-top:16px;border:1px dashed #c0564f;border-radius:10px;padding:11px 12px;background:rgba(192,86,79,.06);">' +
        '<div style="font-size:12px;color:#d98a84;font-weight:bold;margin-bottom:9px;">测试工具 · 仅 beta，正式发布前整块删除</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px;">' +
          tbtn("下楼：直达 s_42 搀扶四选一（复位下楼段）", "WK.TEST.gotoStairChoice()", true) +
          tbtn("剧情：按当前选择结算 s_31 爆炸（谁没扶谁死）", "WK.TEST.fireS31()") +
          tbtn("剧情：直达注水研究区·自我介绍（看救活者报名）", "WK.TEST.gotoLab()") +
          tbtn("B线：直达半空通道 J.D. 苦战营救（帮助/离开 两分支）", "WK.TEST.gotoSewerRescue()", true) +
          tbtn("锚点无敌：" + (godOn ? "已开启（不被 100 米抹杀）· 点击关闭" : "关闭 · 点击开启"), "WK.TEST.toggleGod()") +
          tbtn("辅助：回满生命/体力", "WK.TEST.heal()") +
        "</div>" +
        '<div style="font-size:12px;color:#d9b884;font-weight:bold;margin:13px 0 2px;">探索包 · 章节直达（N15–N22 搜刮/战斗/兑换）</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px;">' +
          tbtn("资源：一键测试包（三卡/纳戒/补给/三贵重品/500点+回满）", "WK.TEST.kit()", true) +
          tbtn("选路窗口：关红后·全队集结主机房（最后搜刮窗口·谈A/谈B）", "WK.TEST.gotoRouteChoice()", true) +
          tbtn("搜刮：B餐厅集装箱群（34箱·张杰在旁会拦你开箱）", "WK.TEST.gotoWarehouse()") +
          tbtn("搜刮：安保/BOW 锁门簇（三卡权限链·保险库·主任样本库）", "WK.TEST.gotoSecurity()") +
          tbtn("战斗：安保犬舍入口（深入主犬舍刷丧尸犬群）", "WK.TEST.gotoKennel()") +
          tbtn("搜刮：员工宿舍区（储物柜/腕表/各房补给）", "WK.TEST.gotoDorm()") +
          tbtn("A线·自由搜刮期（雇佣兵已撤，人在主机房；点张杰开战，可测存档）", "WK.TEST.gotoFinalA()", true) +
          tbtn("A线·直达爬行者最终战（专测战胜/战败都立即回归主神）", "WK.TEST.gotoAFinalNow()") +
          tbtn("主神空间：光球·回收页（测贵重品兑换与各系锁定展示）", "WK.TEST.gotoGodSpace()") +
          tbtn("主神空间：回归完整版（NPC都在房间·训练场开着·测房间对话）", "WK.TEST.goHomeFull()", true) +
          tbtn("v167 战斗：怨灵（物理免疫）靶 —— 发枪+附魔/灵类/神圣弹+神圣手雷+护身符，测双属性", "WK.TEST.gotoGhost()", true) +
        "</div>" +
      "</div>" +
      '<div style="margin-top:16px;display:flex;flex-direction:column;gap:9px;">' +
      '<button class="here-btn" onclick="WK.ui.closeOverlay(\'ov-generic\');setTimeout(function(){WK.ui.openSaveManager(\'watch\');},60)">存档 / 读档（三槽）</button>' +
      "</div>");
  };

  /* 豆包v125：随时开关「重生者·剧情快进」。只影响此后新播放的剧情，不打断当前段。*/
  WK.ui.toggleReborn = function () {
    if (!WK.P) return;
    WK.P.flags = WK.P.flags || {};
    WK.P.flags.reborn = !WK.P.flags.reborn;
    WK.save.write();
    if (!WK.P.flags.reborn && WK.EVT) WK.EVT._fastStop();
    WK.toast(WK.P.flags.reborn ? "剧情快进已开启（我是重生者）" : "已改为逐句观看", "gold");
    WK.ui.closeOverlay("ov-generic");
    WK.ui.openSystem();
  };

  /* ============================================================
   * 豆包N3：全图数据自检（也供自动化走查调用 WK.validateMap()）
   * 校验：区域/坐标齐全、出口目标存在、锁合法、普通出口双向、全图可达
   * ============================================================ */
  WK.validateMap = function () {
    const errors = [];
    const zoneIds = new Set(WK.ZONES.map(z => z.id));
    const roomIds = Object.keys(WK.ROOMS);
    roomIds.forEach(id => {
      const r = WK.ROOMS[id];
      if (!zoneIds.has(r.zone)) errors.push(id + " 的区域 '" + r.zone + "' 不存在");
      if (!WK.MAP[id]) errors.push(id + " 缺少 WK.MAP 坐标");
      Object.keys(r.exits || {}).forEach(d => {
        const info = WK.exitInfo(r.exits[d]);
        if (!WK.ROOMS[info.to]) { errors.push(id + " 的 " + d + " 出口指向不存在房间 " + info.to); return; }
        if (info.lock && !WK.LOCKS[info.lock]) errors.push(id + "→" + info.to + " 使用了未定义锁 " + info.lock);
        // 非传送出口必须双向（反向也得指回来）
        if (info.lock !== "teleport") {
          const back = WK.exitInfo((WK.ROOMS[info.to].exits || {})[OPPOSITE[d]]);
          if (!back || back.to !== id)
            errors.push(id + " " + d + "→" + info.to + " 没有对应的反向出口（应为 " + info.to + " " + OPPOSITE[d] + "→" + id + "）");
        }
      });
    });
    // 从起点 BFS 检查可达性（无视锁；漫游下锁不挡路）
    const seen = new Set(["ti_a"]), queue = ["ti_a"];
    while (queue.length) {
      const cur = queue.shift();
      Object.keys(WK.ROOMS[cur].exits || {}).forEach(d => {
        const info = WK.exitInfo(WK.ROOMS[cur].exits[d]);
        if (info && WK.ROOMS[info.to] && !seen.has(info.to)) { seen.add(info.to); queue.push(info.to); }
      });
    }
    roomIds.forEach(id => { if (!seen.has(id)) errors.push(id + " 从起点 ti_a 不可达"); });
    return { ok: errors.length === 0, errors, roomCount: roomIds.length };
  };

  /* ============================================================
   * 九、标题屏流程
   * ============================================================ */
  WK.ui.refreshIntro = function () {
    const has = WK.save.anyExists();
    document.getElementById("btn-continue").style.display = has ? "" : "none";
    document.getElementById("btn-continue").textContent = "读取存档";
    document.getElementById("btn-clear").style.display = "none"; // 豆包v166：删档并入三槽面板，标题不再单设清除键
    document.getElementById("ver-line").textContent =
      WK.VERSION + " · 《无限恐怖》H5 系列";
  };

  WK.ui.clickNewGame = function () {
    // 豆包v166：三槽时代不再笼统确认覆盖——起名后会让玩家选具体槽位、对单槽二次确认
    WK.ui.askName();
  };

  WK.ui.askName = function () {
    WK.ui.dialog("你是谁？",
      '给自己起个名字。<br><span class="sys">你是被「主神」塞进这部恐怖片的第八名新人。</span>' +
      '<input type="text" id="input-name" placeholder="输入名字（最多 8 字）" maxlength="8">' +
      '<label style="display:flex;align-items:flex-start;gap:9px;margin-top:14px;padding:10px 11px;border:1px solid var(--line2);border-radius:9px;background:var(--panel3);cursor:pointer;">' +
        '<input type="checkbox" id="input-reborn" style="width:17px;height:17px;margin-top:2px;flex-shrink:0;accent-color:var(--gold);">' +
        '<span style="font-size:12.5px;color:var(--dim2);line-height:1.6;"><b style="color:var(--gold);">我是重生者</b><br>' +
        '已看过一遍剧情——大段对白/旁白直接快进，只在短剧情和要你做选择时停一下。首次游玩建议不勾。</span>' +
      '</label>',
      [
        { text: "进入", primary: true, act: () => {
            const v = (document.getElementById("input-name").value || "").trim();
            const reborn = !!(document.getElementById("input-reborn") || {}).checked;
            WK.ui.chooseSlotForNew(v || "无名", reborn);
          }
        }
      ]);
    // 自动聚焦，手机端不强制弹键盘
    setTimeout(() => { const i = document.getElementById("input-name"); if (i) i.focus(); }, 60);
  };

  WK.ui.clickContinue = function () {
    // 豆包v166：继续游戏改为三槽选择（读取/删除）
    if (!WK.save.anyExists()) { WK.toast("还没有任何存档，先开始新游戏", "bad"); WK.ui.refreshIntro(); return; }
    WK.ui.openSaveManager('title');
  };

  WK.ui.clickClearSave = function (fromSystem) {
    const doClear = () => {
      WK.save.clear();
      WK.P = null;
      if (fromSystem) {
        WK.ui.closeOverlay("ov-generic");
        WK.ui.openSystem();
      }
      WK.ui.refreshIntro();
      WK.toast("存档已清除", "gold");
    };
    if (fromSystem) {
      WK.ui.closeOverlay("ov-generic");
      WK.ui.dialog("清除存档", '<span class="danger">存档删除后无法恢复。</span>', [
        { text: "确认删除", danger: true, act: () => { doClear(); WK.ui.closeOverlay("ov-dialog"); } },
        { text: "取消", act: () => WK.ui.closeOverlay("ov-dialog") }
      ]);
    } else {
      doClear();
    }
  };

  /* ============================================================
   * 十、进入游戏世界（N1：进占位办公室；N10 起替换为列车苏醒正式开场）
   * ============================================================ */
  /* ============================================================
   * 豆包v124：脱战生命恢复（vital regen）
   * ------------------------------------------------------------
   * 常驻 1 秒节拍，enterWorld 时启动一次（标志防重复）；回到标题 WK.P=null 后空转。
   * 规则：仅在「不在 ATB 战斗中」且 hp 没满时，每秒回最大生命的 hpRegenPerSec（默认 1%）。
   * 战斗中不回，保留压迫感；看剧情、走房间都算喘息，连续战斗之间能把血缓回来。
   * 回复量是小数时用 _hpAcc 攒整，避免 maxHp 高时每秒 floor 成 0 永远不回。
   * ============================================================ */
  WK.vitals = {
    timer: null, _ticks: 0,
    start(){ if (this.timer) return; this.timer = setInterval(() => this.tick(), 1000); },
    tick(){
      const p = WK.P;
      if (!p || p.dead) return;
      if (WK.battle && WK.battle.state && WK.battle.state.active) return;  // 战斗中不回血
      const max = p.maxHp || 100;
      if (p.hp >= max){ if (p._hpAcc) p._hpAcc = 0; return; }
      p._hpAcc = (p._hpAcc || 0) + max * (WK.RULES.hpRegenPerSec || 0);
      if (p._hpAcc >= 1){
        const add = Math.floor(p._hpAcc); p._hpAcc -= add;
        p.hp = Math.min(max, p.hp + add);
        this._ticks++;
        if (this._ticks % 5 === 0 || p.hp >= max) { this._ticks = 0; WK.save.write(); }  // 每 5 秒或回满落盘
      }
    }
  };

  WK.startGame = function (name, reborn, slot) {
    if (slot != null) WK.save.setSlot(slot);   // 豆包v166：新游戏写入所选槽
    WK.P = newPlayer(name, reborn);
    WK.save.write();
    WK.enterWorld(false);
  };

  WK.enterWorld = function (loaded) {
    WK.ui.closeAll();
    // 豆包v164【P1 致命修复】兑换大表（科技/魔法/辅助/娱乐约2600条）必须在进入世界时装入 ITEM_DEF。
    // 原 v163 仅在 backToTitle() 里调用，正常游玩/读档都不触发，导致买到的武器防具 ITEM_DEF 无定义、
    // slotOf=null 穿不上、战斗用不了。此处新游戏与读档都会经过；catalogInstall 幂等（已存在 id 跳过）。
    if (WK.catalogInstall) WK.catalogInstall();
    document.getElementById("intro").style.display = "none";
    WK.renderScene();
    WK.save.write();
    WK.vitals.start();       // 豆包v124：启动脱战自动回血（新游戏/读档都只挂一次）
    WK.rules.resumeTick();   // 豆包N2：读档后恢复手表倒计时（跨刷新继续走）
    if (WK.STORY10 && WK.STORY10.resumeSquad) WK.STORY10.resumeSquad(); // 豆包v116：恢复下楼梯大部队行进
    if (loaded) {
      WK.log("sys", "读取存档成功，当前位置：" + (WK.ROOMS[WK.P.location] || { name: "?" }).name);
      // v217：旧存档NPC位置迁移——把在g_plaza的NPC移到各自房间，补充缺失的造人NPC
      const godRoomMap = {
        zhangjie: "g_room_zhang",
        zhengzha: "g_room_zheng",
        zhanlan: "g_room_zhan",
        lixiaoyi: "g_room_lixiao",
        luoli: "g_room_zheng",
        naer: "g_room_zhang"
      };
      Object.keys(godRoomMap).forEach(id => {
        if (!WK.P.npcs[id] && WK.NPCS[id]) {
          // 旧存档没有这个NPC，初始化
          WK.P.npcs[id] = { loc: godRoomMap[id], alive: true, met: false };
        } else if (WK.P.npcs[id] && WK.P.npcs[id].alive && WK.P.npcs[id].loc === "g_plaza") {
          // NPC在g_plaza，移到各自房间
          WK.P.npcs[id].loc = godRoomMap[id];
        }
      });
    }
    // 豆包v168：序章「醒来」不再强制弹窗。处于开场门控（stage0、n10_wake 未完成）时，
    // 玩家落在苏醒车厢、移动被锁，这里只给一句引导；剧情由玩家主动点张杰「问话」拉起。
    // 新游戏与读档走同一路径——因此即便读档/误关导致剧情窗丢失，也能再点张杰续看，不再卡死。
    const gate0 = WK.storyGate && WK.storyGate();
    if (gate0) {
      setTimeout(function () {
        WK.toast(gate0.toast || "先找身边的人问问情况", "gold", 2800);
        if (gate0.log) WK.log("sys", gate0.log);
        if (WK.renderPeople) WK.renderPeople();
      }, 320);
    }
  };
