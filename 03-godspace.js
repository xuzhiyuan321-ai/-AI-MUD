/* ============================================================
 * 03-godspace.js — 主神空间
 * 兑换UI、造人、血统系统、光球首次引导
 * ============================================================ */

  /* ============================================================
   * 豆包N13：主神空间 · 四大类兑换（本集开放 属性强化 / 科技 / 辅助）
   * ------------------------------------------------------------
   * 设计（对齐 zhttty 原著口径，复杂实现留给后续卷 / GPT，本模块只做
   * 可运行的简单框架，注释标明扩展点）：
   *   · 奖励点 P.points 为唯一硬通货；恐怖支线 P.branch{S,A,B,C,D} 是
   *     高阶兑换门槛（魔法/武功/机甲多需支线），本集只展示不售卖。
   *   · 属性强化：原著 1 奖励点 = 六维 1 点（普通人均值 100）。
   *   · 科技/辅助技能：购买后写入 P.skills[id]，战斗引擎 battleSkills()
   *     自动拾取（N6 已接好）；被动技能（kind:'passive'）常驻、不占技能按钮。
   *   · 魔法传说 / 武功 / 机甲 / 娱乐：本集在 SHOP.LOCKED 灰显，给出原著价
   *     与支线需求；后续恐怖片只需把对应条目移入 ITEMS 并接好 SKILL_DEF。
   *   · 全身修复：新手集简化为免费（清感染、回满），原著按修复程度扣点，
   *     后续可改成按点计费。
   * 入口：第一集回归后（flags.returned）进入 g_orb 触发 n13_orb 引导；
   *       此后在光球房随时点场景区「触碰光球」按钮再次兑换。
   * ============================================================ */
  /* ============================================================
   * 豆包v142：主神造人 WK.CREATED
   * ------------------------------------------------------------
   * 原著设定：在主神处可「造人」，自定义姓名/性别/身体素质（六维上限 200）。
   *   · 首次免费，其后每造一人 500 奖励点（RULES.createCost）。
   *   · 造出的人存 P.created[]（随存档），本身不在场景里走动；
   *   · 必须在【主神空间】邀请加入队伍；入队后永久同行、可随玩家进每一部恐怖片参战，不会主动离队。
   * 战斗：队友协攻打 WK.party.battleAllies()，本模块 allyOf() 用六维派生 atk/hit/crit，
   *   喂给战斗引擎的形态与 NPC ally 完全一致；本集队友不承伤不倒地，故只派生进攻属性。
   * 扩展点（后续 GPT/大表）：想造非人形、附加血统/技能，可在 create() 后给记录加 skills/skin 字段，
   *   并在 battleAllies 汇合处让 created 也带光环/技能（目前仅基础协攻）。
   * ============================================================ */
  WK.CREATED = {
    ATTR_KEYS:[ ["int","智力"],["spi","精神力"],["cel","细胞活力"],["ner","神经反应"],["mus","肌肉组织"],["imm","免疫力"] ],

    list(){ return (WK.P && WK.P.created) || []; },
    get(id){ return this.list().find(c=>c.id===id) || null; },
    inParty(id){ return (WK.P.party||[]).indexOf(id)>=0; },
    /* 是否身处主神空间（只能在主神广场/光球一带邀请造人入队）*/
    atGodSpace(){ const r=WK.P&&WK.ROOMS[WK.P.location]; return !!r && r.zone==="godspace"; },
    cost(){ const p=WK.P; return this.list().length ? (WK.RULES.createCost||500) : 0; },  // 首个免费

    /* 六维 → 战斗协攻档（普通人均值100；与 NPC ally 同构：{atk,hit,crit,line}）*/
    allyOf(c){
      const a=c.attrs||{};
      const atk = Math.max(3, Math.round((a.mus||100)/7 + (a.ner||100)/40));
      const hit = Math.max(0, Math.min(0.40, ((a.ner||100)-100)/400 + (a.int||100)/2000));
      const crit= Math.max(0, Math.min(0.35, ((a.ner||100)-100)/600));
      return { role:"主神造人 · 同伴", atk:atk, hit:hit, crit:crit,
               line:(c.name+"抬枪开火"), skill:"由主神按你的模板塑造，绝对忠诚、永不背叛。" };
    },

    /* 创建（name/gender/attrs 已校验）。返回 {ok} 或 {ok:false,msg} */
    create(name, gender, attrs){
      const p=WK.P; p.created=Array.isArray(p.created)?p.created:[];
      name=(name||"").trim() || ("造人"+(p.created.length+1)+"号");
      if(p.created.some(c=>c.name===name)) return { ok:false, msg:"已经有一个同名的人了，换个名字吧" };
      const cost=this.cost();
      if(p.points<cost) return { ok:false, msg:"奖励点不足（首次免费，其后需 "+(WK.RULES.createCost||500)+" 点）" };
      if(cost>0) WK.rules.addPoints(-cost, "主神造人 · "+name);
      const c={ id:"cr_"+Date.now(), name:name, gender:gender||"女",
                attrs:{ int:100,spi:100,cel:100,ner:100,mus:100,imm:100 }, t:Date.now() };
      this.ATTR_KEYS.forEach(([k])=>{ c.attrs[k]=this._clamp(attrs[k]); });
      p.created.push(c);
      WK.save.write();
      WK.log("team","主神光柱中走出一个全新的人——"+c.name+"（"+c.gender+"），由你亲手设定其身体素质。"+(cost?("耗费 "+cost+" 奖励点。"):"首次造人免费。"));
      return { ok:true, c:c };
    },
    _clamp(v){ v=parseInt(v,10); if(isNaN(v)) v=100; return Math.max(10, Math.min(200, v)); },

    /* 邀请入队（仅主神空间；入队后永久，不提供踢出，符合"不会离队"）*/
    invite(id){
      const c=this.get(id); if(!c) return;
      if(this.inParty(id)) { WK.toast(c.name+" 已经在你身边","bad"); return; }
      if(!this.atGodSpace()){ WK.toast("只能在主神空间把造出来的人拉进队伍","bad"); return; }
      WK.P.party=WK.P.party||[]; WK.P.party.push(id);
      WK.save.write();
      WK.log("team",c.name+" 握住你的手，从今往后随你出生入死，绝不离队。");
      WK.toast(c.name+" · 加入队伍（永久同行）","gold");
      if(WK.SHOP && document.getElementById("ov-shop").classList.contains("active")) WK.SHOP.render();
      if(typeof WK.renderScene==="function") WK.renderScene();
    },

    /* —— 主神商店「其他」页里的造人面板 —— */
    panelHtml(){
      const list=this.list(), cost=this.cost();
      let h='<div class="shop-note">主神可按你的意志塑造一个活生生的人：自定义姓名、性别与六维身体素质（每项 10~200，普通人均值 100）。' +
        '造出后需<b>在主神空间</b>邀请入队，随后永久同行、随你进入恐怖片并肩作战，永不背叛。<br>' +
        (list.length?('本次再造需 <b style="color:var(--gold)">'+cost+'</b> 奖励点。'):'<b style="color:var(--gold)">首次造人免费</b>。')+'</div>';
      list.forEach(c=>{
        const a=this.allyOf(c), joined=this.inParty(c.id);
        h+='<div class="shop-card'+(joined?" owned":"")+'"><div class="sc-ico">人</div><div class="sc-main">'+
          '<div class="sc-n">'+this._esc(c.name)+' <span class="sc-tag t-base">'+c.gender+'</span>'+(joined?' <span class="sc-tag" style="color:var(--gold);border-color:var(--gold);">永久同行中</span>':'')+'</div>'+
          '<div class="sc-d">六维：智'+c.attrs.int+' 神'+c.attrs.spi+' 活'+c.attrs.cel+' 反'+c.attrs.ner+' 力'+c.attrs.mus+' 免'+c.attrs.imm+
          '　<span style="color:var(--dim2)">协攻 '+a.atk+' / 命中'+Math.round(a.hit*100)+'% / 暴击'+Math.round(a.crit*100)+'%</span></div></div>'+
          '<div class="sc-buy">'+(joined?'<div class="sc-owned">已入队</div>'
            :'<button class="sc-btn primary" onclick="WK.CREATED.invite(\''+c.id+'\')"'+(this.atGodSpace()?"":" disabled")+'>邀请入队</button>')+'</div></div>';
      });
      const dis=WK.P.points<cost;
      h+='<button class="sc-btn" style="width:100%;margin-top:6px;" onclick="WK.CREATED.openForm()" '+(dis?"disabled":"")+'>＋ 主神造人（'+(list.length?(cost+" 点"):"首次免费")+'）</button>';
      if(!this.atGodSpace()) h+='<div class="shop-note" style="margin-top:6px;">（当前不在主神空间，只能查看，邀请入队需回到主神广场。）</div>';
      return h;
    },
    _esc(s){ return WK.EVT&&WK.EVT._esc?WK.EVT._esc(s):String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;"); },

    /* 造人表单（名字/性别/六维）*/
    openForm(){
      const rows=this.ATTR_KEYS.map(([k,label])=>
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 0;">'+
        '<span style="font-size:13px;color:#c8d6c8;">'+label+'</span>'+
        '<input type="number" min="10" max="200" value="100" id="cr_'+k+'" style="width:88px;background:#10150f;border:1px solid var(--line);color:var(--txt);border-radius:7px;padding:7px 9px;font-size:14px;text-align:center;"></div>'
      ).join("");
      const h=
        '<div style="margin-bottom:10px;">'+
          '<div style="font-size:12.5px;color:var(--dim);margin-bottom:4px;">名字</div>'+
          '<input id="cr_name" maxlength="12" placeholder="不给名字就叫「造人N号」" style="width:100%;box-sizing:border-box;background:#10150f;border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:10px;font-size:14px;">'+
        '</div>'+
        '<div style="margin-bottom:12px;">'+
          '<div style="font-size:12.5px;color:var(--dim);margin-bottom:4px;">性别</div>'+
          '<select id="cr_gender" style="width:100%;box-sizing:border-box;background:#10150f;border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:10px;font-size:14px;"><option>女</option><option>男</option></select>'+
        '</div>'+
        '<div class="stat-sec" style="margin:4px 0 6px;">身体素质模板（每项 10~200，普通人均值 100）</div>'+
        '<div style="display:flex;gap:7px;margin-bottom:10px;"><button class="here-btn ghost" style="flex:1;padding:8px;" onclick="WK.CREATED._fill(100)">普通人均值 100</button>'+
        '<button class="here-btn ghost" style="flex:1;padding:8px;" onclick="WK.CREATED._fill(200)">全部拉满 200</button></div>'+
        rows+
        '<div style="display:flex;gap:9px;margin-top:14px;">'+
          '<button class="here-btn primary" style="flex:1;padding:12px;" onclick="WK.CREATED.submitForm()">塑造</button>'+
          '<button class="here-btn ghost" style="flex:0 0 92px;padding:12px;" onclick="WK.ui.closeOverlay(\'ov-generic\')">取消</button></div>'+
        '<div style="font-size:11px;color:var(--dim2);line-height:1.6;margin-top:9px;">造人不额外按属性收费——费用只看造了几个（首个免费，其后每个 '+ (WK.RULES.createCost||500) +' 点）；属性上限 200 是主神对凡人模板的封顶。</div>';
      WK.ui.generic("主神造人", h);
    },
    _fill(v){ this.ATTR_KEYS.forEach(([k])=>{ const el=document.getElementById("cr_"+k); if(el) el.value=v; }); },
    submitForm(){
      const name=(document.getElementById("cr_name")||{}).value||"";
      const gender=(document.getElementById("cr_gender")||{}).value||"女";
      const attrs={}; this.ATTR_KEYS.forEach(([k])=>{ attrs[k]=parseInt((document.getElementById("cr_"+k)||{}).value,10); });
      // 超出 200 直接拦在表单（create 内还会再 clamp 一次兜底）
      for(const k in attrs){ if(attrs[k]>200){ WK.toast("六维上限 200，主神捏不出更强的凡人模板","bad"); return; } }
      const r=this.create(name,gender,attrs);
      if(!r.ok){ WK.toast(r.msg,"bad"); return; }
      WK.ui.closeOverlay("ov-generic");
      WK.toast(r.c.name+" 已塑造完成，在主神空间邀请即可入队","gold");
      this._refreshShop();
    },
    _refreshShop(){ if(WK.SHOP && document.getElementById("ov-shop").classList.contains("active")) WK.SHOP.render(); }
  };


  /* ============================================================
   * 血统系统 · 第1期骨架
   * 兑换 → 主神光柱动画 + 进度条 → 写入 P.bloodlines → 六维进战斗
   * ============================================================ */
  WK.BLOOD_DB = {"虚拟偶像模板": {"name": "虚拟偶像模板", "branch": "C", "price": 2000, "req": null, "desc": "可以为自身设定一个与本人完全不同的虚拟形象，可以从喜爱此形象的生命中抽取极少一部分力量强化自身。", "attrs": {}, "line": "custom_虚拟偶像模板", "tier": 0}, "初级罗睺眷族变异血统": {"name": "初级罗睺眷族变异血统", "branch": "C", "price": 1800, "req": null, "desc": "于幽垠之中诞生的特殊生灵，被创世三圣之一的罗睺神视为眷族。天生拥有极高的负面能量亲和度，可以操作具有侵蚀性的蚀之力。由于是变异血统，因此外貌不会被扭曲为原本眷族的模样，同样也不会受到罗睺神系的支配与压制。", "attrs": {}, "line": "luohou", "tier": 1}, "高级罗睺眷族变异血统": {"name": "高级罗睺眷族变异血统", "branch": "B", "price": 3600, "req": "初级罗睺眷族变异血统", "desc": "于幽垠之中诞生的特殊生灵，被创世三圣之一的罗睺神视为眷族。天生拥有极高的负面能量亲和度，可控制的蚀之力总量大幅度增加，可与正面能量形成相互克制。同时随着血统开发深度的提升，有几率觉醒自己的本命天赋。由于是变异血统，因此外貌不会被扭曲为原本眷族的模样，同样也不会受到罗睺神系的支配与压制。", "attrs": {}, "line": "luohou", "tier": 3}, "罗睺使者血统": {"name": "罗睺使者血统", "branch": "A", "price": 6000, "req": "高级罗睺眷族变异血统", "desc": "被罗睺神以创命之术创造，用于渗透明界，洞开天幕的造物。兑换后获得极强的咒法/武斗天赋（二选一），体内蕴含精纯度极高的幽煌之力。该能量的侵蚀能力相比起蚀较低，但对身体素质的增幅以及能量本身的破坏性远超蚀之力数十倍。兑换者灵魂强度获得大幅度强化，即使肉体被毁，灵魂依旧可以依托其余事物存在一定时间。", "attrs": {}, "line": "luohou", "tier": 0}, "初级神阙宫人模板": {"name": "初级神阙宫人模板", "branch": "2D", "price": 1200, "req": null, "desc": "小幅度提升身体素质，获得灵力能量循环。该能量循环基础性质可参考内力，但较内力更为轻量化，易于操作。但由于轻量化的缘故，较难以此施展大威力的破坏性技能。", "attrs": {}, "line": "shenque", "tier": 1}, "中级神阙宫人模板": {"name": "中级神阙宫人模板", "branch": "2C", "price": 2500, "req": "初级神阙宫人模板", "desc": "一定幅度提升身体素质，强化灵力能量循环。该能量循环基础性质可参考内力，但较内力更为轻量化，易于操作。但由于轻量化的缘故，较难以此施展同等级的大威力破坏性技能。", "attrs": {}, "line": "shenque", "tier": 2}, "高级神阙宫人模板": {"name": "高级神阙宫人模板", "branch": "2B", "price": 5000, "req": "中级神阙宫人模板", "desc": "大幅度强化灵力能量循环，随兑换者能力提升可逐渐将灵力转化为‘灵氛’。该能量性质与真元力性质近似，纯粹威力略低，但更精于变化与术法而易于操作，可适用于大部分需要正面能量的法术。", "attrs": {}, "line": "shenque", "tier": 3}, "蜘蛛侠基因变异血统": {"name": "蜘蛛侠基因变异血统", "branch": "B", "price": 2000, "req": null, "desc": "评价83分，适用于需要高敏捷的恐怖片中，技能蜘蛛丝可以使用在任何情况下。", "attrs": {"mus": 100, "ner": 100, "int": 20, "spi": 20, "cel": 50, "imm": 150}, "line": "spiderman", "tier": 0}, "开膛手变异血统": {"name": "开膛手变异血统", "branch": "B", "price": 1500, "req": null, "desc": "评价81分，适用于需要隐蔽的恐怖片中。技能雾都，所在地区会逐渐弥漫浓雾，浓雾会屏蔽大部分侦测手段，你在雾中会隐形。", "attrs": {"mus": 100, "ner": 150, "int": 50, "spi": 80, "cel": 30, "imm": 50}, "line": "ripper", "tier": 0}, "线索之网血统": {"name": "线索之网血统", "branch": "C", "price": 1000, "req": null, "desc": "评价69分，适用于需要推理的恐怖片中。技能线索之网，可以整合两条线索并得出正确的结论。", "attrs": {"mus": 10, "ner": 30, "int": 150, "spi": 50, "cel": 20, "imm": 10}, "line": "clueweb", "tier": 0}, "T病毒进化模式": {"name": "T病毒进化模式", "branch": "C", "price": 1500, "req": null, "desc": "评价80分，适用于大部分恐怖片。拥有T病毒进化功能。", "attrs": {"mus": 50, "ner": 50, "int": 20, "spi": 20, "cel": 50, "imm": 100}, "line": "tvirus", "tier": 0}, "巨魔变异血统": {"name": "巨魔变异血统", "branch": "B", "price": 4000, "req": null, "desc": "评价86分，适用于需要高生存力的恐怖片中。身躯还剩下二分之一以上时，即使连大脑和心脏都被摧毁，也可以在一小时内复原。", "attrs": {"mus": 200, "ner": 50, "int": 0, "spi": 20, "cel": 500, "imm": 100}, "line": "troll", "tier": 0}, "植物变异血统": {"name": "植物变异血统", "branch": "D", "price": 500, "req": null, "desc": "评价63分，适用于有植物的恐怖片。技能光合作用，沐浴在太阳光下来恢复能量和满足饮食需求。", "attrs": {"mus": 0, "ner": 20, "int": 0, "spi": 0, "cel": 0, "imm": 50}, "line": "plant", "tier": 0}, "初级脑魔变异血统": {"name": "初级脑魔变异血统", "branch": "D", "price": 1200, "req": null, "desc": "", "attrs": {}, "line": "custom_初级脑魔变异血统", "tier": 1}, "中级脑魔变异血统": {"name": "中级脑魔变异血统", "branch": "C", "price": 2400, "req": "初级脑魔变异血统", "desc": "", "attrs": {}, "line": "custom_中级脑魔变异血统", "tier": 2}, "高级脑魔变异血统": {"name": "高级脑魔变异血统", "branch": "B", "price": 3600, "req": "中级脑魔变异血统", "desc": "", "attrs": {}, "line": "custom_高级脑魔变异血统", "tier": 3}, "低阶门徒模板": {"name": "低阶门徒模板", "branch": "D", "price": 800, "req": null, "desc": "适合拥有信仰之人兑换，对身体素质的提升较小，随着兑换者信仰的坚定程度不同，可发挥出力量也会随之变动。", "attrs": {"mus": 10, "ner": 10, "int": 20, "spi": 50, "cel": 10, "imm": 10}, "line": "disciple", "tier": 5}, "中阶门徒模板": {"name": "中阶门徒模板", "branch": "C", "price": 1600, "req": "低阶门徒模板", "desc": "适合拥有信仰之人兑换，足够虔诚者偶尔能从祈祷中获得神恩，带来凡人无法实现的奇迹。", "attrs": {"mus": 30, "ner": 30, "int": 50, "spi": 100, "cel": 30, "imm": 30}, "line": "disciple", "tier": 6}, "高阶门徒模板": {"name": "高阶门徒模板", "branch": "B", "price": 3200, "req": "中阶门徒模板", "desc": "适合践行自己信仰之人兑换。你的力量来源于神，你的神眷顾着你。", "attrs": {"mus": 100, "ner": 100, "int": 300, "spi": 500, "cel": 100, "imm": 100}, "line": "disciple", "tier": 7}, "圣子": {"name": "圣子", "branch": "A", "price": 8000, "req": "高阶门徒模板", "desc": "神就在你的心中。", "attrs": {"mus": 0, "ner": 0, "int": 0, "spi": 0, "cel": 0, "imm": 0}, "line": "custom_圣子", "tier": 0}, "初级魔弹射手血统": {"name": "初级魔弹射手血统", "branch": "DD", "price": 1200, "req": null, "desc": "获得能与射击类武器相兼容的能量，能量稳定性较高，因此可以将其附着在弹药上，形成威力强大的魔弹射击", "attrs": {"mus": 50, "ner": 120, "int": 20, "spi": 80, "cel": 20, "imm": 20}, "line": "magicbullet", "tier": 1}, "中级魔弹射手血统": {"name": "中级魔弹射手血统", "branch": "CC", "price": 2400, "req": "初级魔弹射手血统", "desc": "获得能与射击类武器相兼容的能量，能量稳定性较高，不仅可以将其附着在弹药上，形成威力强大的魔弹射击，还可以用能量代替弹药进行填充", "attrs": {"mus": 120, "ner": 300, "int": 50, "spi": 250, "cel": 50, "imm": 50}, "line": "magicbullet", "tier": 2}, "高级魔弹射手血统": {"name": "高级魔弹射手血统", "branch": "BB", "price": 4800, "req": "中级魔弹射手血统", "desc": "获得能与射击类武器相兼容的能量，能量稳定性高，不易产生因能量失控造成的爆炸与对自身的伤害。", "attrs": {"mus": 300, "ner": 600, "int": 100, "spi": 450, "cel": 100, "imm": 100}, "line": "magicbullet", "tier": 3}, "初级花妖变异血统": {"name": "初级花妖变异血统", "branch": "C", "price": 2000, "req": "植物变异血统", "desc": "评价71分，适用于有植物的恐怖片。技能光合作用与丛林伪装、花妖形态，在丛林中会自动改变为周围景色的颜色。花妖形态下肢体将化为植物根，可以进行钻土、缠绕等动作。", "attrs": {"mus": 20, "ner": 50, "int": 30, "spi": 50, "cel": 0, "imm": 80}, "line": "custom_初级花妖变异血统", "tier": 1}, "中级花妖变异血统": {"name": "中级花妖变异血统", "branch": "B", "price": 4000, "req": "初级花妖变异血统", "desc": "评价78分，适用于有植物的恐怖片。技能光合作用与丛林伪装、花妖形态，在丛林中会自动改变为周围景色的颜色。花妖形态下肢体将化为植物根，可以进行钻土、缠绕等动作。", "attrs": {"mus": 50, "ner": 100, "int": 80, "spi": 100, "cel": 0, "imm": 150}, "line": "custom_中级花妖变异血统", "tier": 2}, "高级花妖变异血统": {"name": "高级花妖变异血统", "branch": "A", "price": 8000, "req": "中级花妖变异血统", "desc": "评价84分，适用于有植物的恐怖片。技能光合作用与丛林伪装、花妖形态，在丛林中会自动改变为周围景色的颜色。花妖形态下肢体将化为植物根，可以进行钻土、缠绕等动作。", "attrs": {"mus": 100, "ner": 200, "int": 150, "spi": 200, "cel": 0, "imm": 300}, "line": "custom_高级花妖变异血统", "tier": 3}, "鱼人宝宝变异血统": {"name": "鱼人宝宝变异血统", "branch": "D", "price": 500, "req": null, "desc": "评价68分，适用于有水的恐怖片。技能水性，能在水下呼吸和生活。因为是变异血统，所以不会有鱼人的外表和习性。", "attrs": {"mus": 20, "ner": 30, "int": 10, "spi": 0, "cel": 20, "imm": 10}, "line": "custom_鱼人宝宝变异血统", "tier": 0}, "鱼人夜行者变异血统": {"name": "鱼人夜行者变异血统", "branch": "B", "price": 2000, "req": "鱼人宝宝变异血统", "desc": "评价79分，适用于大部分恐怖片。技能水性和暗影之舞，能够短时间隐身。因为是变异血统，所以不会有鱼人的外表和习性。", "attrs": {"mus": 80, "ner": 150, "int": 30, "spi": 20, "cel": 50, "imm": 100}, "line": "custom_鱼人夜行者变异血统", "tier": 0}, "鱼人招潮者变异血统": {"name": "鱼人招潮者变异血统", "branch": "B", "price": 1500, "req": "鱼人宝宝变异血统", "desc": "评价76分，适用于大部分恐怖片。技能水性和召唤鱼人，召唤两只鱼人为你作战。", "attrs": {"mus": 30, "ner": 50, "int": 50, "spi": 100, "cel": 50, "imm": 100}, "line": "custom_鱼人招潮者变异血统", "tier": 0}, "暗夜精灵变异血统": {"name": "暗夜精灵变异血统", "branch": "C", "price": 1500, "req": null, "desc": "评价75分，适用于大部分恐怖片。拥有法力的传统暗夜精灵，技能隐藏，在黑夜中暂时隐身，任何行动都会打破隐身。因为是变异血统，所以不会有暗夜精灵的外形和习性。", "attrs": {"mus": 30, "ner": 50, "int": 20, "spi": 40, "cel": 20, "imm": 30}, "line": "custom_暗夜精灵变异血统", "tier": 0}, "血精灵变异血统": {"name": "血精灵变异血统", "branch": "B", "price": 2500, "req": "暗夜精灵变异血统", "desc": "评价85分，适用于大部分恐怖片。渴求法力的暗夜精灵，技能隐藏和汲取能量，可以汲取他人体内能量。因为是变异血统，所以不会有血精灵的外形和习性，也不会有血精灵的魔瘾。", "attrs": {"mus": 50, "ner": 80, "int": 70, "spi": 30, "cel": 40, "imm": 50}, "line": "custom_血精灵变异血统", "tier": 0}, "夜之子变异血统": {"name": "夜之子变异血统", "branch": "B", "price": 2500, "req": "暗夜精灵变异血统", "desc": "评价83分，适用于大部分恐怖片。吸收了暗夜之井能量的暗夜精灵，技能隐藏和感知，能感知周围的魔法波动，可以分辨幻象和隐身。因为是变异血统，所以不会有血精灵的外形和习性，也不会有夜之子的魔瘾。", "attrs": {"mus": 40, "ner": 60, "int": 80, "spi": 60, "cel": 30, "imm": 40}, "line": "custom_夜之子变异血统", "tier": 0}, "娜迦变异血统": {"name": "娜迦变异血统", "branch": "B", "price": 5000, "req": "暗夜精灵变异血统", "desc": "评价87分，适用于大部分恐怖片。受到了上古之神祝福的暗夜精灵，技能水之亲和，能在水下生活、呼吸并逐渐强化水之能量。因为是变异血统，所以不会有娜迦的外表和习性。部分法术会改变。", "attrs": {"mus": 150, "ner": 180, "int": 50, "spi": 50, "cel": 100, "imm": 120}, "line": "custom_娜迦变异血统", "tier": 0}, "见习幻影刺客血统": {"name": "见习幻影刺客血统", "branch": "D", "price": 500, "req": null, "desc": "评价66分，适用于需要隐蔽的恐怖片，还未学会幻影之术的刺客。", "attrs": {"mus": 10, "ner": 50, "int": 20, "spi": 10, "cel": 0, "imm": 0}, "line": "custom_见习幻影刺客血统", "tier": 0}, "初级幻影刺客血统": {"name": "初级幻影刺客血统", "branch": "C", "price": 2000, "req": "初级幻影刺客血统", "desc": "评价73分，适用于需要隐蔽的恐怖片。技能初级模糊，短时间半透明。", "attrs": {"mus": 30, "ner": 150, "int": 50, "spi": 30, "cel": 10, "imm": 10}, "line": "custom_初级幻影刺客血统", "tier": 1}, "中级幻影刺客血统": {"name": "中级幻影刺客血统", "branch": "B", "price": 5000, "req": "初级幻影刺客血统", "desc": "评价82分，适用于需要隐蔽的恐怖片。技能中级模糊，短时间近乎透明且免疫常规侦测手段。", "attrs": {"mus": 80, "ner": 400, "int": 120, "spi": 100, "cel": 30, "imm": 30}, "line": "custom_中级幻影刺客血统", "tier": 2}, "高级幻影刺客血统": {"name": "高级幻影刺客血统", "branch": "A", "price": 10000, "req": "中级幻影刺客血统", "desc": "评价91分，适用于需要隐蔽的恐怖片。技能高级模糊，短时间完全透明且免疫绝大部分侦测手段。", "attrs": {"mus": 150, "ner": 800, "int": 250, "spi": 200, "cel": 50, "imm": 50}, "line": "custom_高级幻影刺客血统", "tier": 3}, "初级驯兽师血统": {"name": "初级驯兽师血统", "branch": "D", "price": 500, "req": null, "desc": "评价64分，适用于野兽多的恐怖片。技能驯兽，能够驯服野兽并使其成为动物伙伴。最多拥有一个动物伙伴。", "attrs": {"mus": 20, "ner": 20, "int": 20, "spi": 20, "cel": 20, "imm": 20}, "line": "custom_初级驯兽师血统", "tier": 1}, "中级驯兽师血统": {"name": "中级驯兽师血统", "branch": "2D", "price": 1200, "req": "初级驯兽师血统", "desc": "评价68分，适用于野兽多的恐怖片。技能驯兽，能够驯服野兽并使其成为动物伙伴。最多拥有两个动物伙伴。", "attrs": {"mus": 40, "ner": 40, "int": 40, "spi": 40, "cel": 40, "imm": 40}, "line": "custom_中级驯兽师血统", "tier": 2}, "高级驯兽师血统": {"name": "高级驯兽师血统", "branch": "C", "price": 2000, "req": "中级驯兽师血统", "desc": "评价72分，适用于野兽多的恐怖片。技能驯兽，能够驯服野兽并使其成为动物伙伴。最多拥有三个动物伙伴。", "attrs": {"mus": 60, "ner": 60, "int": 60, "spi": 60, "cel": 60, "imm": 60}, "line": "custom_高级驯兽师血统", "tier": 3}, "见习猎人血统": {"name": "见习猎人血统", "branch": "C", "price": 3000, "req": "初级驯兽师血统", "desc": "评价73分，适用于需要远程支援的恐怖片，可以集中精神释放法术的猎人，技能驯兽，最多拥有一个动物伙伴。", "attrs": {"mus": 60, "ner": 100, "int": 20, "spi": 80, "cel": 40, "imm": 20}, "line": "custom_见习猎人血统", "tier": 0}, "荒野猎人血统": {"name": "荒野猎人血统", "branch": "B", "price": 6000, "req": "初级驯兽师血统", "desc": "评价80分，适用于需要远程支援的恐怖片，可以集中精神释放法术的猎人，技能驯兽，最多拥有一个动物伙伴。", "attrs": {"mus": 120, "ner": 200, "int": 60, "spi": 150, "cel": 80, "imm": 50}, "line": "custom_荒野猎人血统", "tier": 0}, "传奇猎人血统": {"name": "传奇猎人血统", "branch": "A", "price": 9000, "req": "初级驯兽师血统", "desc": "评价88分，适用于需要远程支援的恐怖片，可以集中精神释放法术的猎人，技能驯兽，最多拥有一个动物伙伴。", "attrs": {"mus": 200, "ner": 350, "int": 100, "spi": 250, "cel": 120, "imm": 90}, "line": "custom_传奇猎人血统", "tier": 0}, "初阶弓箭手血统": {"name": "初阶弓箭手血统", "branch": "D", "price": 400, "req": null, "desc": "评价58分，适用于需要远程攻击的恐怖片，能够学习初阶弓术技能的射手。", "attrs": {"mus": 30, "ner": 50, "int": 10, "spi": 0, "cel": 0, "imm": 0}, "line": "custom_初阶弓箭手血统", "tier": 0}, "中阶弓箭手血统": {"name": "中阶弓箭手血统", "branch": "2D", "price": 800, "req": "初阶弓箭手血统", "desc": "评价61分，适用于需要远程攻击的恐怖片，能够学习中阶弓术技能的射手。", "attrs": {"mus": 60, "ner": 100, "int": 20, "spi": 0, "cel": 0, "imm": 0}, "line": "custom_中阶弓箭手血统", "tier": 6}, "高阶弓箭手血统": {"name": "高阶弓箭手血统", "branch": "C", "price": 1500, "req": "中阶弓箭手血统", "desc": "评价67分，适用于需要远程攻击的恐怖片，能够学习高阶弓术技能的射手。", "attrs": {"mus": 120, "ner": 200, "int": 40, "spi": 0, "cel": 0, "imm": 0}, "line": "custom_高阶弓箭手血统", "tier": 7}, "初阶自然射手血统": {"name": "初阶自然射手血统", "branch": "C", "price": 2000, "req": "高阶弓箭手", "desc": "评价73分，适用于需要远程攻击的恐怖片。技能初级自然射击，调动自然能量射出一支具有自然属性的魔法箭。", "attrs": {"mus": 50, "ner": 100, "int": 20, "spi": 30, "cel": 100, "imm": 150}, "line": "custom_初阶自然射手血统", "tier": 0}, "中阶自然射手血统": {"name": "中阶自然射手血统", "branch": "B", "price": 4000, "req": "初阶自然射手血统", "desc": "评价81分，适用于需要远程攻击的恐怖片。技能中级自然射击，调动自然能量射出一支具有自然属性的魔法箭。", "attrs": {"mus": 100, "ner": 200, "int": 40, "spi": 60, "cel": 200, "imm": 300}, "line": "custom_中阶自然射手血统", "tier": 6}, "高阶自然射手血统": {"name": "高阶自然射手血统", "branch": "A", "price": 8000, "req": "中阶自然射手血统", "desc": "评价88分，适用于需要远程攻击的恐怖片。技能高级自然射击，调动自然能量射出一支具有自然属性的魔法箭。", "attrs": {"mus": 150, "ner": 300, "int": 60, "spi": 100, "cel": 300, "imm": 500}, "line": "custom_高阶自然射手血统", "tier": 7}, "初阶火焰射手血统": {"name": "初阶火焰射手血统", "branch": "C", "price": 1500, "req": "高阶弓箭手", "desc": "评价74分，适用于需要远程攻击的恐怖片。技能初级火焰射击，调动火焰能量射出一支具有火焰属性的魔法箭。", "attrs": {"mus": 150, "ner": 150, "int": 0, "spi": 0, "cel": 50, "imm": 30}, "line": "custom_初阶火焰射手血统", "tier": 0}, "中阶火焰射手血统": {"name": "中阶火焰射手血统", "branch": "B", "price": 3000, "req": "初阶火焰射手血统", "desc": "评价84分，适用于需要远程攻击的恐怖片。技能中级火焰射击，调动火焰能量射出一支具有火焰属性的魔法箭。", "attrs": {"mus": 300, "ner": 300, "int": 0, "spi": 0, "cel": 100, "imm": 60}, "line": "custom_中阶火焰射手血统", "tier": 6}, "高阶火焰射手血统": {"name": "高阶火焰射手血统", "branch": "A", "price": 6000, "req": "中阶火焰射手血统", "desc": "评价92分，适用于需要远程攻击的恐怖片。技能高级火焰射击，调动火焰能量射出一支具有火焰属性的魔法箭。", "attrs": {"mus": 500, "ner": 500, "int": 0, "spi": 0, "cel": 150, "imm": 100}, "line": "custom_高阶火焰射手血统", "tier": 7}, "初阶冰霜射手血统": {"name": "初阶冰霜射手血统", "branch": "C", "price": 1500, "req": "高阶弓箭手", "desc": "评价74分，适用于需要远程攻击的恐怖片。技能初级冰霜射击，调动冰霜能量射出一支具有冰霜属性的魔法箭。", "attrs": {"mus": 80, "ner": 80, "int": 50, "spi": 100, "cel": 30, "imm": 20}, "line": "custom_初阶冰霜射手血统", "tier": 0}, "中阶冰霜射手血统": {"name": "中阶冰霜射手血统", "branch": "B", "price": 3000, "req": "初阶冰霜射手血统", "desc": "评价82分，适用于需要远程攻击的恐怖片。技能中级冰霜射击，调动冰霜能量射出一支具有冰霜属性的魔法箭。", "attrs": {"mus": 160, "ner": 160, "int": 100, "spi": 200, "cel": 60, "imm": 40}, "line": "custom_中阶冰霜射手血统", "tier": 6}, "高阶冰霜射手血统": {"name": "高阶冰霜射手血统", "branch": "A", "price": 6000, "req": "中阶冰霜射手血统", "desc": "评价90分，适用于需要远程攻击的恐怖片。技能高级冰霜射击，调动冰霜能量射出一支具有冰霜属性的魔法箭。", "attrs": {"mus": 250, "ner": 250, "int": 150, "spi": 300, "cel": 100, "imm": 60}, "line": "custom_高阶冰霜射手血统", "tier": 7}, "初阶弓斗师血统": {"name": "初阶弓斗师血统", "branch": "C", "price": 1500, "req": "高阶弓箭手", "desc": "评价76分，适用于需要远程攻击的恐怖片，能够学习初阶弓斗术的射手。", "attrs": {"mus": 50, "ner": 80, "int": 200, "spi": 0, "cel": 0, "imm": 0}, "line": "custom_初阶弓斗师血统", "tier": 0}, "中阶弓斗师血统": {"name": "中阶弓斗师血统", "branch": "B", "price": 3000, "req": "初阶弓斗师血统", "desc": "评价86分，适用于需要远程攻击的恐怖片，能够学习中阶弓斗术的射手。", "attrs": {"mus": 100, "ner": 160, "int": 400, "spi": 0, "cel": 0, "imm": 0}, "line": "custom_中阶弓斗师血统", "tier": 6}, "高阶弓斗师血统": {"name": "高阶弓斗师血统", "branch": "A", "price": 6000, "req": "中阶弓斗师血统", "desc": "评价94分，适用于需要远程攻击的恐怖片，能够学习高阶弓斗术的射手。", "attrs": {"mus": 150, "ner": 250, "int": 600, "spi": 0, "cel": 0, "imm": 0}, "line": "custom_高阶弓斗师血统", "tier": 7}, "风系射手血统": {"name": "风系射手血统", "branch": "C", "price": 2500, "req": null, "desc": "评价77分，适用于大部分恐怖片，在有弓的情况下能够面对任何情况。技能风箭，调动全身的风之能量来提高箭矢威力。", "attrs": {"mus": 50, "ner": 100, "int": 20, "spi": 40, "cel": 10, "imm": 50}, "line": "custom_风系射手血统", "tier": 0}, "风系神射手血统": {"name": "风系神射手血统", "branch": "B", "price": 5000, "req": "风精灵射手血统", "desc": "评价86分，适用于大部分恐怖片，在有弓的情况下能够面对任何情况。技能风之矢，调动全身的风之能量来大幅度提高箭矢威力。", "attrs": {"mus": 100, "ner": 250, "int": 50, "spi": 80, "cel": 30, "imm": 120}, "line": "custom_风系神射手血统", "tier": 0}, "月光射手血统": {"name": "月光射手血统", "branch": "C", "price": 2500, "req": null, "desc": "评价75分，适用于大部分恐怖片，在满月时能够发挥出最大威力。技能月箭，发出聚集月光之力的全力一箭。", "attrs": {"mus": 40, "ner": 60, "int": 30, "spi": 80, "cel": 30, "imm": 20}, "line": "custom_月光射手血统", "tier": 0}, "月光神射手血统": {"name": "月光神射手血统", "branch": "B", "price": 5000, "req": "月光射手血统", "desc": "评价83分，适用于大部分恐怖片，在满月时能够发挥出最大威力。技能月之矢，发出聚集月光精华的全力一箭。", "attrs": {"mus": 80, "ner": 120, "int": 60, "spi": 200, "cel": 60, "imm": 50}, "line": "custom_月光神射手血统", "tier": 0}, "枪手血统": {"name": "枪手血统", "branch": "D", "price": 2000, "req": null, "desc": "评价67分，适用于需要远程火力的恐怖片。技能召唤枪械，召唤只能由自己使用的无限子弹枪械，同一时间只能存在一支被召唤的枪械。", "attrs": {"mus": 50, "ner": 80, "int": 50, "spi": 50, "cel": 30, "imm": 10}, "line": "custom_枪手血统", "tier": 0}, "高斯枪手血统": {"name": "高斯枪手血统", "branch": "C", "price": 5000, "req": "枪手血统", "desc": "评价74分，适用于需要远程火力的恐怖片。技能召唤高斯枪械，召唤只能由自己使用的无限子弹高斯枪械，同一时间只能存在一支被召唤的枪械。", "attrs": {"mus": 100, "ner": 150, "int": 100, "spi": 100, "cel": 70, "imm": 30}, "line": "custom_高斯枪手血统", "tier": 0}, "脉冲枪手血统": {"name": "脉冲枪手血统", "branch": "B", "price": 10000, "req": "高斯枪手血统", "desc": "评价82分，适用于需要远程火力的恐怖片。技能召唤脉冲枪械，召唤只能由自己使用的无限子弹脉冲枪械，同一时间只能存在一支被召唤的枪械。", "attrs": {"mus": 200, "ner": 300, "int": 200, "spi": 200, "cel": 150, "imm": 50}, "line": "custom_脉冲枪手血统", "tier": 0}, "魔枪手血统": {"name": "魔枪手血统", "branch": "C", "price": 3000, "req": "枪手血统", "desc": "评价78分，适用于需要远程火力的恐怖片，拥有少量法力的枪手。技能附魔子弹，可以令接下来射出的子弹附加一种魔法效果。", "attrs": {"mus": 50, "ner": 100, "int": 100, "spi": 80, "cel": 30, "imm": 10}, "line": "custom_魔枪手血统", "tier": 0}, "双重魔枪手血统": {"name": "双重魔枪手血统", "branch": "B", "price": 6000, "req": "魔枪手血统", "desc": "评价85分，适用于需要远程火力的恐怖片，拥有法力的魔枪手。技能双重附魔子弹，可以领接下来射出的子弹附加两种魔法效果。", "attrs": {"mus": 100, "ner": 200, "int": 200, "spi": 150, "cel": 50, "imm": 20}, "line": "custom_双重魔枪手血统", "tier": 0}, "初级鹰眼狙击手血统": {"name": "初级鹰眼狙击手血统", "branch": "C", "price": 2000, "req": null, "desc": "评价74分，适用于远程狙击型，适用于大范围战场类恐怖片。技能初级鹰眼，提高动态视力和静态视力。", "attrs": {"mus": 50, "ner": 100, "int": 10, "spi": 10, "cel": 30, "imm": 20}, "line": "custom_初级鹰眼狙击手血统", "tier": 1}, "中级鹰眼狙击手血统": {"name": "中级鹰眼狙击手血统", "branch": "B", "price": 4000, "req": "初级鹰眼狙击手血统", "desc": "评价83分，适用于远程狙击型，适用于大范围战场类恐怖片。技能中级鹰眼和弱点看破，可以看到目标的弱点和要害。", "attrs": {"mus": 100, "ner": 200, "int": 20, "spi": 20, "cel": 60, "imm": 40}, "line": "custom_中级鹰眼狙击手血统", "tier": 2}, "高级鹰眼狙击手血统": {"name": "高级鹰眼狙击手血统", "branch": "A", "price": 8000, "req": "中级鹰眼狙击手血统", "desc": "评价90分，适用于远程狙击型，适用于大范围战场类恐怖片。技能高级鹰眼、弱点看破和要害必中，可以进行必定攻向目标要害的远程攻击。", "attrs": {"mus": 200, "ner": 400, "int": 40, "spi": 40, "cel": 120, "imm": 80}, "line": "custom_高级鹰眼狙击手血统", "tier": 3}, "初级闪灵强化基因": {"name": "初级闪灵强化基因", "branch": "D", "price": 1000, "req": null, "desc": "评价72分，适用于大部分恐怖片，技能闪灵，让兑换者在十秒内自身速度提高数倍，也会被动的提高对精神攻击的抗性。", "attrs": {"mus": 20, "ner": 50, "int": 10, "spi": 10, "cel": 10, "imm": 10}, "line": "shining", "tier": 1}, "中级闪灵强化基因": {"name": "中级闪灵强化基因", "branch": "C", "price": 2000, "req": "初级闪灵强化基因", "desc": "评价78分，适用于大部分恐怖片，技能闪灵，让兑换者在十秒内自身速度提高数倍，也会被动的提高对精神攻击的抗性。", "attrs": {"mus": 50, "ner": 100, "int": 20, "spi": 20, "cel": 20, "imm": 20}, "line": "shining", "tier": 2}, "高级闪灵强化基因": {"name": "高级闪灵强化基因", "branch": "B", "price": 4000, "req": "中级闪灵强化基因", "desc": "评价84分，适用于大部分恐怖片，技能闪灵，让兑换者在十秒内自身速度提高数倍，也会被动的提高对精神攻击的抗性。", "attrs": {"mus": 100, "ner": 200, "int": 50, "spi": 50, "cel": 50, "imm": 50}, "line": "shining", "tier": 3}, "特级闪灵强化基因": {"name": "特级闪灵强化基因", "branch": "A", "price": 7000, "req": "高级闪灵强化基因", "desc": "评价89分，适用于大部分恐怖片，技能闪灵，让兑换者在十秒内自身速度提高数倍，也会被动的提高对精神攻击的抗性。", "attrs": {"mus": 200, "ner": 400, "int": 100, "spi": 100, "cel": 100, "imm": 100}, "line": "shining", "tier": 4}, "最终闪灵强化基因": {"name": "最终闪灵强化基因", "branch": "AA", "price": 15000, "req": "特级闪灵强化基因", "desc": "评价94分，适用于大部分恐怖片，技能闪灵，让兑换者在十秒内自身速度提高数倍，也会被动的提高对精神攻击的抗性。", "attrs": {"mus": 500, "ner": 1000, "int": 200, "spi": 200, "cel": 200, "imm": 200}, "line": "shining", "tier": 0}, "初级守望者基因": {"name": "初级守望者基因", "branch": "D", "price": 500, "req": null, "desc": "评价67分，适用于对抗单体强力敌人的恐怖片。技能追猎，十秒内令目标减速且对你产生恐惧。", "attrs": {"mus": 20, "ner": 30, "int": 10, "spi": 10, "cel": 20, "imm": 10}, "line": "custom_初级守望者基因", "tier": 1}, "中级守望者基因": {"name": "中级守望者基因", "branch": "C", "price": 1000, "req": "初级守望者基因", "desc": "评价74分，适用于对抗单体强力敌人的恐怖片。技能追猎，十秒内令目标减速且对你产生恐惧。", "attrs": {"mus": 40, "ner": 60, "int": 20, "spi": 20, "cel": 40, "imm": 20}, "line": "custom_中级守望者基因", "tier": 2}, "高级守望者基因": {"name": "高级守望者基因", "branch": "B", "price": 2000, "req": "中级守望者基因", "desc": "评价80分，适用于对抗单体强力敌人的恐怖片。技能追猎，十秒内令目标减速且对你产生恐惧。", "attrs": {"mus": 80, "ner": 120, "int": 40, "spi": 40, "cel": 80, "imm": 40}, "line": "custom_高级守望者基因", "tier": 3}, "终极守望者基因": {"name": "终极守望者基因", "branch": "A", "price": 4000, "req": "高级守望者基因", "desc": "评价88分，适用于对抗单体强力敌人的恐怖片。技能追猎，十秒内令目标减速且对你产生恐惧。", "attrs": {"mus": 200, "ner": 300, "int": 100, "spi": 100, "cel": 200, "imm": 100}, "line": "custom_终极守望者基因", "tier": 0}, "初级一拳基因": {"name": "初级一拳基因", "branch": "D", "price": 500, "req": null, "desc": "评价68分，适用于需要近战的恐怖片。小幅度提升肉体潜力，但需要足够的锻炼才能发挥出来。", "attrs": {"mus": 30, "ner": 20, "int": 0, "spi": 0, "cel": 20, "imm": 10}, "line": "custom_初级一拳基因", "tier": 1}, "中级一拳基因": {"name": "中级一拳基因", "branch": "2D", "price": 1000, "req": "初级一拳基因", "desc": "评价74分，适用于需要近战的恐怖片。一定程度上提升肉体潜力，需要足够的锻炼将其开发出来。", "attrs": {"mus": 60, "ner": 40, "int": 0, "spi": 0, "cel": 40, "imm": 20}, "line": "custom_中级一拳基因", "tier": 2}, "高级一拳基因": {"name": "高级一拳基因", "branch": "2C", "price": 2500, "req": "中级一拳基因", "desc": "评价80分，适用于需要近战的恐怖片。大幅提升肉体潜力，需要进行巨量锻炼将其发掘。技能双倍拳力。", "attrs": {"mus": 150, "ner": 100, "int": 0, "spi": 0, "cel": 100, "imm": 40}, "line": "custom_高级一拳基因", "tier": 3}, "终极一拳基因": {"name": "终极一拳基因", "branch": "2B", "price": 8000, "req": "高级一拳基因", "desc": "评价90分，适用于需要近战的恐怖片。极大幅度提升肉体潜力，需要进行巨量锻炼将其发掘。技能五倍拳力。", "attrs": {"mus": 600, "ner": 400, "int": 0, "spi": 0, "cel": 400, "imm": 150}, "line": "custom_终极一拳基因", "tier": 0}, "一拳超人基因": {"name": "一拳超人基因", "branch": "2A", "price": 20000, "req": "终极一拳基因", "desc": "评价96分，适用于需要近战的恐怖片。技能十倍拳力和认真模式，认真模式下肌肉组织强度翻倍。", "attrs": {"mus": 1500, "ner": 1000, "int": 0, "spi": 0, "cel": 1000, "imm": 400}, "line": "custom_一拳超人基因", "tier": 0}, "初级狼人变异血统": {"name": "初级狼人变异血统", "branch": "D", "price": 600, "req": null, "desc": "评价72分，适用于需要近战的恐怖片。技能狼人变可以异体化，短时间内小幅度提高身体素质，加强身体硬度与恢复力，因为是变异血统，所以兑换者不会被狼人血统本能所控制。", "attrs": {"mus": 80, "ner": 50, "int": 0, "spi": 0, "cel": 20, "imm": 30}, "line": "werewolf", "tier": 1}, "中级狼人变异血统": {"name": "中级狼人变异血统", "branch": "C", "price": 1800, "req": "初级狼人变异血统", "desc": "评价80分，适用于需要近战的恐怖片。技能狼人变可以异体化，短时间内中幅度提高身体素质，加强身体硬度与恢复力，因为是变异血统，所以兑换者不会被狼人血统本能所控制。", "attrs": {"mus": 200, "ner": 120, "int": 0, "spi": 0, "cel": 50, "imm": 80}, "line": "werewolf", "tier": 2}, "高级狼人变异血统": {"name": "高级狼人变异血统", "branch": "B", "price": 2700, "req": "中级狼人变异血统", "desc": "评价88分，适用于大部分恐怖片。技能狼人变可以异体化，短时间内大幅度提高身体素质，加强身体硬度与恢复力，因为是变异血统，所以兑换者不会被狼人血统本能所控制。", "attrs": {"mus": 400, "ner": 300, "int": 0, "spi": 0, "cel": 100, "imm": 150}, "line": "werewolf", "tier": 3}, "狼王变异血统": {"name": "狼王变异血统", "branch": "A", "price": 5000, "req": "高级狼人变异血统", "desc": "评价96分，适用于大部分恐怖片。技能狼人变可以异体化，短时间内极大幅度提高身体素质，加强身体硬度与恢复力，因为是变异血统，所以兑换者不会被狼人血统本能所控制。", "attrs": {"mus": 1000, "ner": 700, "int": 0, "spi": 0, "cel": 200, "imm": 300}, "line": "custom_狼王变异血统", "tier": 0}, "初级雪怪变异血统": {"name": "初级雪怪变异血统", "branch": "D", "price": 700, "req": null, "desc": "评价69分，适用于冰雪环境的恐怖片。技能雪怪形态，短时间内小幅度提高身体素质、肌肉组织强度和耐寒性。因为是变异血统，所以不惧怕火焰。", "attrs": {"mus": 40, "ner": 10, "int": 0, "spi": 0, "cel": 30, "imm": 20}, "line": "custom_初级雪怪变异血统", "tier": 1}, "中级雪怪变异血统": {"name": "中级雪怪变异血统", "branch": "C", "price": 1500, "req": "初级雪怪变异血统", "desc": "评价75分，适用于冰雪环境的恐怖片。技能雪怪形态，短时间内中幅度提高身体素质、肌肉组织强度和耐寒性。因为是变异血统，所以不惧怕火焰。", "attrs": {"mus": 100, "ner": 30, "int": 0, "spi": 0, "cel": 70, "imm": 50}, "line": "custom_中级雪怪变异血统", "tier": 2}, "高级雪怪变异血统": {"name": "高级雪怪变异血统", "branch": "B", "price": 4000, "req": "中级雪怪变异血统", "desc": "评价82分，适用于冰雪环境的恐怖片。技能雪怪形态，短时间内大幅度提高身体素质、肌肉组织强度和耐寒性。因为是变异血统，所以不惧怕火焰。", "attrs": {"mus": 250, "ner": 60, "int": 0, "spi": 0, "cel": 180, "imm": 120}, "line": "custom_高级雪怪变异血统", "tier": 3}, "神秘雪怪变异血统": {"name": "神秘雪怪变异血统", "branch": "A", "price": 10000, "req": "高级雪怪变异血统", "desc": "评价89分，适用于冰雪环境的恐怖片。技能雪怪形态，短时间内极大幅度提高身体素质、肌肉组织强度和耐寒性。因为是变异血统，所以不惧怕火焰。", "attrs": {"mus": 600, "ner": 150, "int": 0, "spi": 0, "cel": 400, "imm": 300}, "line": "custom_神秘雪怪变异血统", "tier": 0}, "初级狂战士血统": {"name": "初级狂战士血统", "branch": "D", "price": 500, "req": null, "desc": "评价74分，适用于需要近战的恐怖片。技能狂战士，受伤越重战斗力越强，最大可提升一倍战斗力。", "attrs": {"mus": 40, "ner": 20, "int": 0, "spi": 0, "cel": 10, "imm": 0}, "line": "custom_初级狂战士血统", "tier": 1}, "中级狂战士血统": {"name": "中级狂战士血统", "branch": "C", "price": 1200, "req": "初级狂战士血统", "desc": "评价81分，适用于需要近战的恐怖片。技能狂战士，受伤越重战斗力越强，最大可提升两倍战斗力。", "attrs": {"mus": 100, "ner": 50, "int": 0, "spi": 0, "cel": 20, "imm": 0}, "line": "custom_中级狂战士血统", "tier": 2}, "高级狂战士血统": {"name": "高级狂战士血统", "branch": "B", "price": 3500, "req": "中级狂战士血统", "desc": "评价88分，适用于需要近战的恐怖片。技能狂战士，受伤越重战斗力越强，最大可提升三倍战斗力。", "attrs": {"mus": 250, "ner": 150, "int": 0, "spi": 0, "cel": 50, "imm": 0}, "line": "custom_高级狂战士血统", "tier": 3}, "终极狂战士血统": {"name": "终极狂战士血统", "branch": "A", "price": 8000, "req": "高级狂战士血统", "desc": "评价92分，适用于需要近战的恐怖片。技能狂战士，受伤越重战斗力越强，最大可提升五倍战斗力。", "attrs": {"mus": 500, "ner": 300, "int": 0, "spi": 0, "cel": 100, "imm": 0}, "line": "custom_终极狂战士血统", "tier": 0}, "嗜血狂战士血统": {"name": "嗜血狂战士血统", "branch": "A", "price": 5000, "req": "高级狂战士血统", "desc": "评价94分，适用于需要近战的恐怖片。技能嗜血狂战士，受伤越重战斗力越强，最大可提升三倍战斗力，且近战攻击能够恢复自身伤势。", "attrs": {"mus": 300, "ner": 200, "int": 0, "spi": 0, "cel": 100, "imm": 50}, "line": "custom_嗜血狂战士血统", "tier": 0}, "血族男爵变异血统": {"name": "血族男爵变异血统", "branch": "D", "price": 800, "req": null, "desc": "评价77分，适用于大部分恐怖片，技能血族能量可以使用部分血族技能，男爵级血族生命力大增，脑部与心脏不被破坏，生命就能不停复原，因为是变异血统，所以兑换者不会惧怕阳光，银等等", "attrs": {"mus": 30, "ner": 20, "int": 10, "spi": 10, "cel": 40, "imm": 10}, "line": "vampire", "tier": 8}, "血族子爵变异血统": {"name": "血族子爵变异血统", "branch": "C", "price": 1500, "req": "血族男爵变异血统", "desc": "评价84分，适用于大部分恐怖片，技能血族能量可以使用部分血族技能，男爵级血族生命力大增，脑部与心脏不被破坏，生命就能不停复原，因为是变异血统，所以兑换者不会惧怕阳光，银等等", "attrs": {"mus": 60, "ner": 50, "int": 20, "spi": 30, "cel": 80, "imm": 30}, "line": "vampire", "tier": 9}, "血族伯爵变异血统": {"name": "血族伯爵变异血统", "branch": "B", "price": 3000, "req": "血族子爵变异血统", "desc": "评价90分，适用于大部分恐怖片，技能血族能量可以使用部分血族技能，伯爵级血族生命力大增，脑部与心脏不被破坏，生命就能不停复原，因为是变异血统，所以兑换者不会惧怕阳光，银等等", "attrs": {"mus": 130, "ner": 90, "int": 40, "spi": 50, "cel": 150, "imm": 60}, "line": "vampire", "tier": 10}, "血族侯爵变异血统": {"name": "血族侯爵变异血统", "branch": "A", "price": 6000, "req": "血族伯爵变异血统", "desc": "评价92分，适用于大部分恐怖片，技能血族能量可以使用部分血族技能，伯爵级血族生命力大增，脑部与心脏不被破坏，生命就能不停复原，因为是变异血统，所以兑换者不会惧怕阳光，银等等", "attrs": {"mus": 280, "ner": 160, "int": 80, "spi": 90, "cel": 280, "imm": 120}, "line": "vampire", "tier": 11}, "血族亲王变异血统": {"name": "血族亲王变异血统", "branch": "AA", "price": 12000, "req": "血族侯爵变异血统", "desc": "评价95分，适用于大部分恐怖片，技能血族能量可以使用部分血族技能，伯爵级血族生命力大增，脑部与心脏不被破坏，生命就能不停复原，因为是变异血统，所以兑换者不会惧怕阳光，银等等", "attrs": {"mus": 600, "ner": 300, "int": 150, "spi": 160, "cel": 550, "imm": 250}, "line": "vampire", "tier": 12}, "血族帝王变异血统": {"name": "血族帝王变异血统", "branch": "S", "price": 25000, "req": "血族亲王变异血统", "desc": "评价98分，适用于大部分恐怖片，技能血族能量可以使用部分血族技能，伯爵级血族生命力大增，脑部与心脏不被破坏，生命就能不停复原，因为是变异血统，所以兑换者不会惧怕阳光，银等等", "attrs": {"mus": 1300, "ner": 550, "int": 300, "spi": 300, "cel": 1000, "imm": 500}, "line": "vampire", "tier": 13}, "1/8兽人变异血统": {"name": "1/8兽人变异血统", "branch": "D", "price": 800, "req": null, "desc": "评价66分，适用于需要近战的恐怖片。技能1/8兽人之血，短时间内提高近战伤害。因为是变异血统，所以不会有兽人的外形特征和性格。", "attrs": {"mus": 60, "ner": 30, "int": 0, "spi": 0, "cel": 30, "imm": 0}, "line": "custom_1_8兽人变异血统", "tier": 0}, "1/4兽人变异血统": {"name": "1/4兽人变异血统", "branch": "C", "price": 2000, "req": "1/8兽人变异血统", "desc": "评价75分，适用于需要近战的恐怖片。技能1/4兽人之血，短时间内提高近战伤害。因为是变异血统，所以不会有兽人的外形特征和性格。", "attrs": {"mus": 150, "ner": 80, "int": 0, "spi": 0, "cel": 80, "imm": 0}, "line": "custom_1_4兽人变异血统", "tier": 0}, "1/2兽人变异血统": {"name": "1/2兽人变异血统", "branch": "B", "price": 5000, "req": "1/4兽人变异血统", "desc": "评价84分，适用于需要近战的恐怖片。技能1/2兽人之血，短时间内提高近战伤害。因为是变异血统，所以不会有兽人的外形特征和性格。", "attrs": {"mus": 400, "ner": 200, "int": 0, "spi": 0, "cel": 200, "imm": 0}, "line": "custom_1_2兽人变异血统", "tier": 0}, "完全体兽人变异血统": {"name": "完全体兽人变异血统", "branch": "A", "price": 11000, "req": "1/2兽人变异血统", "desc": "评价90分，适用于需要近战的恐怖片。技能兽人之血，短时间内提高近战伤害。因为是变异血统，所以不会有兽人的外形特征和性格。", "attrs": {"mus": 900, "ner": 400, "int": 0, "spi": 0, "cel": 400, "imm": 0}, "line": "custom_完全体兽人变异血统", "tier": 0}, "邪兽人变异血统": {"name": "邪兽人变异血统", "branch": "S", "price": 24000, "req": "完全体兽人变异血统", "desc": "评价95分，适用于需要近战的恐怖片。技能邪兽人之血，短时间内提高近战伤害且无视高阶生物威压。因为是变异血统，所以不会有邪兽人的外形特征和性格。", "attrs": {"mus": 2000, "ner": 800, "int": 0, "spi": 0, "cel": 800, "imm": 0}, "line": "custom_邪兽人变异血统", "tier": 0}, "小型土元素变异血统": {"name": "小型土元素变异血统", "branch": "D", "price": 700, "req": null, "desc": "评价70分，适用于需要高生存的恐怖片。技能土元素硬化皮肤，被动提高皮肤防御力。", "attrs": {"mus": 100, "ner": 0, "int": 0, "spi": 0, "cel": 0, "imm": 50}, "line": "custom_小型土元素变异血统", "tier": 0}, "中型土元素变异血统": {"name": "中型土元素变异血统", "branch": "C", "price": 1600, "req": "小型土元素变异血统", "desc": "评价78分，适用于需要高生存的恐怖片。技能土元素硬化皮肤，被动提高皮肤防御力。", "attrs": {"mus": 200, "ner": 0, "int": 0, "spi": 0, "cel": 0, "imm": 100}, "line": "custom_中型土元素变异血统", "tier": 0}, "大型土元素变异血统": {"name": "大型土元素变异血统", "branch": "B", "price": 3400, "req": "中型土元素变异血统", "desc": "评价87分，适用于需要高生存的恐怖片。技能土元素硬化皮肤，被动提高皮肤防御力。", "attrs": {"mus": 400, "ner": 0, "int": 0, "spi": 0, "cel": 0, "imm": 200}, "line": "custom_大型土元素变异血统", "tier": 0}, "巨型土元素变异血统": {"name": "巨型土元素变异血统", "branch": "A", "price": 7000, "req": "大型土元素变异血统", "desc": "评价93分，适用于需要高生存的恐怖片。技能土元素硬化皮肤，被动提高皮肤防御力。", "attrs": {"mus": 800, "ner": 0, "int": 0, "spi": 0, "cel": 0, "imm": 400}, "line": "custom_巨型土元素变异血统", "tier": 0}, "低速鹰身女妖变异血统": {"name": "低速鹰身女妖变异血统", "branch": "D", "price": 500, "req": null, "desc": "评价65分，适用于需要高机动性的恐怖片。技能低速飞行，展开翅膀来进行低速飞行。因为是变异血统，所以没有鹰身女妖的外形、性格或习性。", "attrs": {"mus": 10, "ner": 30, "int": 0, "spi": 0, "cel": 10, "imm": 20}, "line": "custom_低速鹰身女妖变异血统", "tier": 0}, "中速鹰身女妖变异血统": {"name": "中速鹰身女妖变异血统", "branch": "C", "price": 1000, "req": "低速鹰身女妖变异血统", "desc": "评价73分，适用于需要高机动性的恐怖片。技能中速飞行，展开翅膀来进行中速飞行。因为是变异血统，所以没有鹰身女妖的外形、性格或习性。", "attrs": {"mus": 20, "ner": 60, "int": 0, "spi": 0, "cel": 20, "imm": 40}, "line": "custom_中速鹰身女妖变异血统", "tier": 0}, "高速鹰身女妖变异血统": {"name": "高速鹰身女妖变异血统", "branch": "B", "price": 2000, "req": "中速鹰身女妖变异血统", "desc": "评价82分，适用于需要高机动性的恐怖片。技能高速飞行，展开翅膀来进行高速飞行。因为是变异血统，所以没有鹰身女妖的外形、性格或习性。", "attrs": {"mus": 40, "ner": 120, "int": 0, "spi": 0, "cel": 40, "imm": 80}, "line": "custom_高速鹰身女妖变异血统", "tier": 0}, "鹰身女妖侦察者变异血统": {"name": "鹰身女妖侦察者变异血统", "branch": "A", "price": 5000, "req": "高速鹰身女妖变异血统", "desc": "评价88分，适用于需要高机动性的恐怖片。技能高速飞行和女妖侦察，大幅度提高飞行时的动态和静态视力。因为是变异血统，所以没有鹰身女妖的外形、性格或习性。", "attrs": {"mus": 100, "ner": 300, "int": 20, "spi": 0, "cel": 100, "imm": 200}, "line": "custom_鹰身女妖侦察者变异血统", "tier": 0}, "鹰身女妖巫婆变异血统": {"name": "鹰身女妖巫婆变异血统", "branch": "A", "price": 6000, "req": "高速鹰身女妖变异血统", "desc": "评价91分，适用于大部分恐怖片。技能高速飞行和女妖魔法，拥有法力但只能学习风系和自然系法术。因为是变异血统，所以没有鹰身女妖的外形、性格或习性。", "attrs": {"mus": 80, "ner": 240, "int": 0, "spi": 200, "cel": 80, "imm": 160}, "line": "custom_鹰身女妖巫婆变异血统", "tier": 0}, "矮人变异血统": {"name": "矮人变异血统", "branch": "D", "price": 400, "req": null, "desc": "评价70分，适用于大部分恐怖片。技能矮人皮肤，短时间提高对魔法的抗性。因为是变异血统，所以不会有矮人的外形、性格或习性。", "attrs": {"mus": 50, "ner": 0, "int": 0, "spi": 0, "cel": 20, "imm": 10}, "line": "custom_矮人变异血统", "tier": 0}, "矮人战士变异血统": {"name": "矮人战士变异血统", "branch": "C", "price": 800, "req": "矮人变异血统", "desc": "评价78分，适用于需要近战的恐怖片。技能矮人战士，短时间提高对魔法的抗性与近战技巧。因为是变异血统，所以不会有矮人的外形、性格或习性。", "attrs": {"mus": 60, "ner": 40, "int": 0, "spi": 0, "cel": 30, "imm": 20}, "line": "custom_矮人战士变异血统", "tier": 0}, "矮人山丘之王变异血统": {"name": "矮人山丘之王变异血统", "branch": "B", "price": 4000, "req": "矮人战士变异血统", "desc": "评价88分，适用于需要近战的恐怖片。技能天神下凡，短时间魔法免疫并提高防御力和战斗力。因为是变异血统，所以不会有矮人的外形、性格或习性", "attrs": {"mus": 300, "ner": 100, "int": 0, "spi": 0, "cel": 80, "imm": 50}, "line": "custom_矮人山丘之王变异血统", "tier": 0}, "矮人锻造师变异血统": {"name": "矮人锻造师变异血统", "branch": "C", "price": 1200, "req": "矮人变异血统", "desc": "评价82分，适用于大部分恐怖片。技能矮人皮肤和锻造，能够强化/锻造装备。因为是变异血统，所以不会有矮人的外形、性格或习性。", "attrs": {"mus": 40, "ner": 20, "int": 50, "spi": 0, "cel": 30, "imm": 20}, "line": "custom_矮人锻造师变异血统", "tier": 0}, "矮人附魔师变异血统": {"name": "矮人附魔师变异血统", "branch": "C", "price": 1400, "req": "矮人变异血统", "desc": "评价80分，适用于大部分恐怖片。技能矮人皮肤和附魔，能够为装备附魔结晶/能量石/符文。因为是变异血统，所以不会有矮人的外形、性格或习性。", "attrs": {"mus": 10, "ner": 30, "int": 60, "spi": 50, "cel": 20, "imm": 10}, "line": "custom_矮人附魔师变异血统", "tier": 0}, "初级催眠师血统": {"name": "初级催眠师血统", "branch": "D", "price": 500, "req": null, "desc": "评价44分，适用于需要接触智慧生物的恐怖片中，技能催眠，能够通过特定行为让目标进入被催眠状态，成功率与对方的精神力有关。", "attrs": {"mus": 0, "ner": 0, "int": 30, "spi": 50, "cel": 0, "imm": 0}, "line": "custom_初级催眠师血统", "tier": 1}, "中级催眠师血统": {"name": "中级催眠师血统", "branch": "C", "price": 1000, "req": "初级催眠师血统", "desc": "评价70分，适用于需要接触智慧生物的恐怖片中，技能精神力催眠，能够用精神力让目标进入被催眠状态，成功率与双方精神力的差距有关。", "attrs": {"mus": 0, "ner": 0, "int": 50, "spi": 100, "cel": 0, "imm": 0}, "line": "custom_中级催眠师血统", "tier": 2}, "高级催眠师血统": {"name": "高级催眠师血统", "branch": "B", "price": 2000, "req": "中级催眠师血统", "desc": "评价87分，适用于需要接触智慧生物的恐怖片中，技能精神力控制，能够用精神力直接控制目标，成功率与双方精神力的差距以及目标的意志力有关。", "attrs": {"mus": 0, "ner": 0, "int": 100, "spi": 200, "cel": 0, "imm": 0}, "line": "custom_高级催眠师血统", "tier": 3}, "计算师血统": {"name": "计算师血统", "branch": "D", "price": 300, "req": null, "desc": "评价61分，适用于需要智慧的恐怖片，技能行为计算，通过复杂计算来提高操作成功率", "attrs": {"mus": 0, "ner": 20, "int": 60, "spi": 0, "cel": 0, "imm": 0}, "line": "custom_计算师血统", "tier": 0}, "计算大师血统": {"name": "计算大师血统", "branch": "C", "price": 800, "req": "计算师血统", "desc": "评价68分，适用于需要智慧的恐怖片，技能行为计算，通过复杂计算来提高操作成功率", "attrs": {"mus": 0, "ner": 50, "int": 200, "spi": 0, "cel": 0, "imm": 0}, "line": "custom_计算大师血统", "tier": 0}, "神算师血统": {"name": "神算师血统", "branch": "B", "price": 4000, "req": "计算大师血统", "desc": "评价85分，适用于需要智慧的恐怖片，技能神算，通过复杂计算来提高操作成功率并预计算出成功率", "attrs": {"mus": 0, "ner": 200, "int": 1000, "spi": 0, "cel": 0, "imm": 0}, "line": "custom_神算师血统", "tier": 0}, "三眼族变异血统": {"name": "三眼族变异血统", "branch": "B", "price": 1000, "req": null, "desc": "评价72分，适用于需要智慧的恐怖片，提高计算力。", "attrs": {"mus": 0, "ner": 0, "int": 1000, "spi": 0, "cel": 0, "imm": 0}, "line": "custom_三眼族变异血统", "tier": 0}, "见习武僧血统": {"name": "见习武僧血统", "branch": "D", "price": 500, "req": null, "desc": "评价71分，适用于需要近战的恐怖片中，身具气功的武僧。技能初级锻体，小幅度提高了防御力和对精神攻击的抗性。", "attrs": {"mus": 20, "ner": 30, "int": 10, "spi": 10, "cel": 30, "imm": 20}, "line": "custom_见习武僧血统", "tier": 0}, "熟练武僧血统": {"name": "熟练武僧血统", "branch": "C", "price": 1200, "req": null, "desc": "评价78分，适用于需要近战的恐怖片中，身具气功的武僧。技能中级锻体，中幅度提高了防御力和对精神攻击的抗性。", "attrs": {"mus": 50, "ner": 70, "int": 20, "spi": 20, "cel": 70, "imm": 50}, "line": "custom_熟练武僧血统", "tier": 0}, "大师武僧血统": {"name": "大师武僧血统", "branch": "B", "price": 2500, "req": null, "desc": "评价86分，适用于需要近战的恐怖片中，身具气功的武僧。技能高级锻体，大幅度提高了防御力和对精神攻击的抗性。", "attrs": {"mus": 100, "ner": 150, "int": 50, "spi": 50, "cel": 150, "imm": 100}, "line": "custom_大师武僧血统", "tier": 0}, "传奇武僧血统": {"name": "传奇武僧血统", "branch": "A", "price": 5000, "req": null, "desc": "评价93分，适用于需要近战的恐怖片中，身具气功的武僧。技能传奇锻体，极大幅度提高了防御力和对精神攻击的抗性。", "attrs": {"mus": 200, "ner": 300, "int": 100, "spi": 100, "cel": 300, "imm": 200}, "line": "custom_传奇武僧血统", "tier": 0}, "初级恶魔猎手血统": {"name": "初级恶魔猎手血统", "branch": "D", "price": 700, "req": null, "desc": "评价74分，适用于需要近战的恐怖片，运用邪能对抗恶魔的猎手。技能幽灵视觉，牺牲了常规视觉换取了幽灵视觉，可以透过障碍物看到敌人，也能看到隐形单位。", "attrs": {"mus": 20, "ner": 40, "int": 10, "spi": 10, "cel": 10, "imm": 10}, "line": "custom_初级恶魔猎手血统", "tier": 1}, "中级恶魔猎手血统": {"name": "中级恶魔猎手血统", "branch": "C", "price": 1500, "req": "初级恶魔猎手血统", "desc": "评价81分，适用于需要近战的恐怖片，运用邪能对抗恶魔的猎手。技能幽灵视觉和初级恶魔形态，恶魔形态下战斗力小幅度提高。", "attrs": {"mus": 50, "ner": 100, "int": 20, "spi": 20, "cel": 20, "imm": 20}, "line": "custom_中级恶魔猎手血统", "tier": 2}, "高级恶魔猎手血统": {"name": "高级恶魔猎手血统", "branch": "B", "price": 3000, "req": "中级恶魔猎手血统", "desc": "评价88分，适用于需要近战的恐怖片，运用邪能对抗恶魔的猎手。技能幽灵视觉和中级恶魔形态，恶魔形态下战斗力中幅度提高。", "attrs": {"mus": 100, "ner": 200, "int": 50, "spi": 50, "cel": 50, "imm": 50}, "line": "custom_高级恶魔猎手血统", "tier": 3}, "传奇恶魔猎手血统": {"name": "传奇恶魔猎手血统", "branch": "A", "price": 6000, "req": "高级恶魔猎手血统", "desc": "评价92分，适用于需要近战的恐怖片，运用邪能对抗恶魔的猎手。技能幽灵视觉和高级恶魔形态，恶魔形态下战斗力大幅度提高。", "attrs": {"mus": 200, "ner": 400, "int": 100, "spi": 100, "cel": 100, "imm": 100}, "line": "custom_传奇恶魔猎手血统", "tier": 0}, "异形变异开发血统": {"name": "异形变异开发血统", "branch": "B", "price": 4000, "req": null, "desc": "评价88分，适用于需要近战的恐怖片中。技能异形血脉，拥有腐蚀血液、攀爬能力、异形视力、战斗本能，可以在五种分支中切换，在血统融合时有更高成功率。因为是变异血统，所以不会被异形皇后控制，也不会有异形的身体变异。", "attrs": {"mus": 150, "ner": 200, "int": 0, "spi": 0, "cel": 100, "imm": 300}, "line": "custom_异形变异开发血统", "tier": 0}, "哨兵异形变异血统": {"name": "哨兵异形变异血统", "branch": "D", "price": 0, "req": "异形变异开发血统", "desc": "哨兵异形拥有较强的智慧，战斗能力一般。", "attrs": {"mus": 20, "ner": 20, "int": 100, "spi": 100, "cel": 20, "imm": 20}, "line": "custom_哨兵异形变异血统", "tier": 0}, "雄蜂异形变异血统": {"name": "雄蜂异形变异血统", "branch": "D", "price": 1000, "req": "异形变异开发血统", "desc": "雄蜂异形拥有更好的战斗本能，实力较为平衡。", "attrs": {"mus": 50, "ner": 50, "int": 0, "spi": 0, "cel": 50, "imm": 50}, "line": "custom_雄蜂异形变异血统", "tier": 0}, "信使异形变异血统": {"name": "信使异形变异血统", "branch": "D", "price": 1000, "req": "异形变异开发血统", "desc": "信使异形拥有最快的速度和最灵敏的身手。", "attrs": {"mus": 0, "ner": 100, "int": 0, "spi": 0, "cel": 20, "imm": 20}, "line": "custom_信使异形变异血统", "tier": 0}, "战士异形变异血统": {"name": "战士异形变异血统", "branch": "D", "price": 2000, "req": "异形变异开发血统", "desc": "战士异形拥有较高的实力，可以吐出酸液攻击。", "attrs": {"mus": 80, "ner": 80, "int": 0, "spi": 0, "cel": 80, "imm": 80}, "line": "custom_战士异形变异血统", "tier": 0}, "禁卫异形变异血统": {"name": "禁卫异形变异血统", "branch": "D", "price": 2000, "req": "异形变异开发血统", "desc": "禁卫异形拥有最强大的力量和防御力，失去了敏捷性和攀爬能力。", "attrs": {"mus": 150, "ner": 0, "int": 0, "spi": 0, "cel": 100, "imm": 50}, "line": "custom_禁卫异形变异血统", "tier": 0}, "凤凰后裔变异血统": {"name": "凤凰后裔变异血统", "branch": "D", "price": 800, "req": null, "desc": "评价71分，适用于大部分恐怖片。技能凤凰火焰，免疫火焰且全身包裹在凤凰火焰之中。因为是变异血统，所以不会有凤凰的外貌、习性、弱点。", "attrs": {"mus": 20, "ner": 20, "int": 10, "spi": 10, "cel": 40, "imm": 30}, "line": "custom_凤凰后裔变异血统", "tier": 0}, "幼年凤凰变异血统": {"name": "幼年凤凰变异血统", "branch": "C", "price": 2000, "req": "凤凰后裔变异血统", "desc": "评价75分，适用于大部分恐怖片。技能凤凰火焰。因为是变异血统，所以不会有凤凰的外貌、习性、弱点。", "attrs": {"mus": 50, "ner": 50, "int": 20, "spi": 20, "cel": 100, "imm": 70}, "line": "custom_幼年凤凰变异血统", "tier": 0}, "成年凤凰变异血统": {"name": "成年凤凰变异血统", "branch": "B", "price": 6000, "req": "幼年凤凰变异血统", "desc": "评价85分，适用于大部分恐怖片。技能凤凰火焰和涅槃重生，受到致命伤害时变为凤凰蛋，在合适的条件下将从凤凰蛋中重生。因为是变异血统，所以不会有凤凰的外貌、习性、弱点。", "attrs": {"mus": 120, "ner": 120, "int": 50, "spi": 50, "cel": 250, "imm": 160}, "line": "custom_成年凤凰变异血统", "tier": 0}, "壮年凤凰变异血统": {"name": "壮年凤凰变异血统", "branch": "A", "price": 15000, "req": "成年凤凰变异血统", "desc": "评价91分，适用于大部分恐怖片。技能凤凰火焰和涅槃重生。因为是变异血统，所以不会有凤凰的外貌、习性、弱点。", "attrs": {"mus": 300, "ner": 300, "int": 120, "spi": 120, "cel": 650, "imm": 400}, "line": "custom_壮年凤凰变异血统", "tier": 0}, "凤凰之神变异血统": {"name": "凤凰之神变异血统", "branch": "S", "price": 40000, "req": "壮年凤凰变异血统", "desc": "评价97分，适用于大部分恐怖片。技能凤凰火焰和涅槃重生。因为是变异血统，所以不会有凤凰的外貌、习性、弱点。", "attrs": {"mus": 800, "ner": 800, "int": 300, "spi": 300, "cel": 2400, "imm": 1000}, "line": "custom_凤凰之神变异血统", "tier": 0}, "幼年龙战士血统": {"name": "幼年龙战士血统", "branch": "D", "price": 500, "req": null, "desc": "评价68分，适用于需要近战的恐怖片，技能幼年龙形态，幼年龙形态下免疫火焰且战斗力上升", "attrs": {"mus": 30, "ner": 20, "int": 0, "spi": 0, "cel": 20, "imm": 10}, "line": "custom_幼年龙战士血统", "tier": 0}, "成年龙战士血统": {"name": "成年龙战士血统", "branch": "C", "price": 2000, "req": "幼年龙战士血统", "desc": "评价75分，适用于需要近战的恐怖片，技能成年龙形态，成年龙形态下免疫火焰且战斗力上升", "attrs": {"mus": 80, "ner": 50, "int": 0, "spi": 0, "cel": 50, "imm": 30}, "line": "custom_成年龙战士血统", "tier": 0}, "巨龙战士血统": {"name": "巨龙战士血统", "branch": "B", "price": 5000, "req": "成年龙战士血统", "desc": "评价83分，使用于需要近战的恐怖片，技能巨龙形态，巨龙形态下免疫火焰且战斗力上升", "attrs": {"mus": 300, "ner": 150, "int": 0, "spi": 0, "cel": 150, "imm": 80}, "line": "custom_巨龙战士血统", "tier": 0}, "真龙战士血统": {"name": "真龙战士血统", "branch": "A", "price": 8000, "req": "巨龙战士血统", "desc": "评价91分，适用于需要近战的恐怖片，技能真龙形态，真龙形态下免疫火焰且战斗力上升", "attrs": {"mus": 500, "ner": 300, "int": 0, "spi": 0, "cel": 300, "imm": 150}, "line": "custom_真龙战士血统", "tier": 0}, "神龙战士血统": {"name": "神龙战士血统", "branch": "S", "price": 16000, "req": "真龙战士血统", "desc": "评价97分，适用于需要近战的恐怖片，技能神龙形态，神龙形态下免疫火焰且战斗力上升", "attrs": {"mus": 2000, "ner": 1000, "int": 0, "spi": 0, "cel": 1000, "imm": 500}, "line": "custom_神龙战士血统", "tier": 0}, "初级剑士血统": {"name": "初级剑士血统", "branch": "D", "price": 800, "req": null, "desc": "评价71分，适用于大部分恐怖片，技能剑气，可以用剑发出剑气。", "attrs": {"mus": 50, "ner": 30, "int": 10, "spi": 10, "cel": 20, "imm": 20}, "line": "custom_初级剑士血统", "tier": 1}, "中级剑士血统": {"name": "中级剑士血统", "branch": "C", "price": 1800, "req": "初级剑士血统", "desc": "评价77分，适用于大部分恐怖片，技能剑气，可以用剑发出剑气。", "attrs": {"mus": 120, "ner": 80, "int": 20, "spi": 20, "cel": 50, "imm": 50}, "line": "custom_中级剑士血统", "tier": 2}, "高级剑士血统": {"name": "高级剑士血统", "branch": "B", "price": 3500, "req": "中级剑士血统", "desc": "评价85分，适用于大部分恐怖片，技能剑气，可以用剑发出剑气。", "attrs": {"mus": 250, "ner": 150, "int": 50, "spi": 50, "cel": 100, "imm": 100}, "line": "custom_高级剑士血统", "tier": 3}, "剑圣血统": {"name": "剑圣血统", "branch": "A", "price": 6000, "req": "高级剑士血统", "desc": "评价91分，适用于大部分恐怖片，技能剑气，可以用剑发出剑气。", "attrs": {"mus": 400, "ner": 300, "int": 100, "spi": 100, "cel": 200, "imm": 200}, "line": "custom_剑圣血统", "tier": 0}, "剑神血统": {"name": "剑神血统", "branch": "S", "price": 15000, "req": "剑圣血统", "desc": "评价97分，适用于大部分恐怖片，技能剑气，可以用剑发出剑气。", "attrs": {"mus": 1000, "ner": 800, "int": 200, "spi": 200, "cel": 500, "imm": 500}, "line": "custom_剑神血统", "tier": 0}, "初级风之剑士血统": {"name": "初级风之剑士血统", "branch": "D", "price": 500, "req": null, "desc": "评价70分，适用于大部分恐怖片。技能初级风之剑，将风之能量附着在兵刃上，小幅度提高兵刃威力。", "attrs": {"mus": 20, "ner": 20, "int": 10, "spi": 10, "cel": 10, "imm": 10}, "line": "custom_初级风之剑士血统", "tier": 1}, "中级风之剑士血统": {"name": "中级风之剑士血统", "branch": "C", "price": 1200, "req": "初级风之剑士血统", "desc": "评价76分，适用于大部分恐怖片。技能中级风之剑，将风之能量附着在兵刃上，中幅度提高兵刃威力。", "attrs": {"mus": 50, "ner": 50, "int": 20, "spi": 30, "cel": 30, "imm": 20}, "line": "custom_中级风之剑士血统", "tier": 2}, "高级风之剑士血统": {"name": "高级风之剑士血统", "branch": "B", "price": 2500, "req": "中级风之剑士血统", "desc": "评价82分，适用于大部分恐怖片。技能高级风之剑，将风之能量附着在兵刃上，大幅度提高兵刃威力。", "attrs": {"mus": 100, "ner": 100, "int": 50, "spi": 70, "cel": 70, "imm": 50}, "line": "custom_高级风之剑士血统", "tier": 3}, "疾风剑豪血统": {"name": "疾风剑豪血统", "branch": "A", "price": 7000, "req": "高级风之剑士血统", "desc": "评价90分，适用于大部分恐怖片。技能高级风之剑和风之壁障，可以创造阻挡魔法和投射物的墙壁。", "attrs": {"mus": 250, "ner": 250, "int": 120, "spi": 150, "cel": 150, "imm": 120}, "line": "custom_疾风剑豪血统", "tier": 0}, "暗杀者血统": {"name": "暗杀者血统", "branch": "C", "price": 1500, "req": null, "desc": "评价76分，适用于大部分恐怖片。技能气息遮蔽，能够隐藏杀意和实力。", "attrs": {"mus": 50, "ner": 100, "int": 30, "spi": 30, "cel": 20, "imm": 30}, "line": "custom_暗杀者血统", "tier": 0}, "夜行者血统": {"name": "夜行者血统", "branch": "B", "price": 4000, "req": "暗杀者血统", "desc": "评价80分，适用于大部分恐怖片。技能气息遮蔽和夜行，在光线暗淡处能够完全隐身，任何行动都不会破除隐身状态。", "attrs": {"mus": 100, "ner": 250, "int": 80, "spi": 80, "cel": 50, "imm": 80}, "line": "custom_夜行者血统", "tier": 0}, "火元素师学徒血统": {"name": "火元素师学徒血统", "branch": "D", "price": 600, "req": null, "desc": "评价65分，适用于需要火焰法术的恐怖片。技能火焰能量循环体系，能够调动能量生产火焰。", "attrs": {"mus": 0, "ner": 20, "int": 50, "spi": 50, "cel": 0, "imm": 0}, "line": "custom_火元素师学徒血统", "tier": 0}, "火元素师专家血统": {"name": "火元素师专家血统", "branch": "C", "price": 1200, "req": "火元素师学徒血统", "desc": "评价70分，适用于需要火焰法术的恐怖片。技能火焰能量循环体系，能够调动能量生产火焰。", "attrs": {"mus": 0, "ner": 50, "int": 100, "spi": 100, "cel": 0, "imm": 0}, "line": "custom_火元素师专家血统", "tier": 0}, "火元素师大师血统": {"name": "火元素师大师血统", "branch": "B", "price": 2400, "req": "火元素师专家血统", "desc": "评价78分，适用于需要火焰法术的恐怖片。技能火焰能量循环体系，能够调动能量生产火焰。", "attrs": {"mus": 0, "ner": 100, "int": 200, "spi": 200, "cel": 0, "imm": 0}, "line": "custom_火元素师大师血统", "tier": 0}, "火元素师宗师血统": {"name": "火元素师宗师血统", "branch": "A", "price": 4800, "req": "火元素师大师血统", "desc": "评价87分，适用于需要火焰法术的恐怖片。技能火焰能量循环体系，能够调动能量生产火焰。", "attrs": {"mus": 0, "ner": 200, "int": 400, "spi": 400, "cel": 0, "imm": 0}, "line": "custom_火元素师宗师血统", "tier": 0}, "水生法师学徒血统": {"name": "水生法师学徒血统", "branch": "D", "price": 400, "req": null, "desc": "评价67分，适用于需要水系法术的恐怖片，接近水时能量恢复速度提高。技能水之呼唤，制造出纯净水或者恢复自身水之能量。", "attrs": {"mus": 0, "ner": 10, "int": 20, "spi": 20, "cel": 0, "imm": 10}, "line": "custom_水生法师学徒血统", "tier": 0}, "水生法师专家血统": {"name": "水生法师专家血统", "branch": "C", "price": 1000, "req": "水生法师学徒血统", "desc": "评价72分，适用于需要水系法术的恐怖片，接近水时能量恢复速度提高。技能水之呼唤，制造出纯净水或者恢复自身水之能量。", "attrs": {"mus": 0, "ner": 30, "int": 60, "spi": 60, "cel": 0, "imm": 30}, "line": "custom_水生法师专家血统", "tier": 0}, "水生法师大师血统": {"name": "水生法师大师血统", "branch": "B", "price": 2500, "req": "水生法师专家血统", "desc": "评价80分，适用于需要水系法术的恐怖片，接近水时能量恢复速度提高。技能水之呼唤，制造出纯净水或者恢复自身水之能量。", "attrs": {"mus": 0, "ner": 100, "int": 200, "spi": 200, "cel": 0, "imm": 100}, "line": "custom_水生法师大师血统", "tier": 0}, "水生法师宗师血统": {"name": "水生法师宗师血统", "branch": "A", "price": 6000, "req": "水生法师大师血统", "desc": "评价89分，适用于需要水系法术的恐怖片，接近水时能量恢复速度提高。技能水之呼唤，制造出纯净水或者恢复自身水之能量。", "attrs": {"mus": 0, "ner": 300, "int": 600, "spi": 600, "cel": 0, "imm": 300}, "line": "custom_水生法师宗师血统", "tier": 0}, "元素崇拜者血统": {"name": "元素崇拜者血统", "branch": "D", "price": 200, "req": null, "desc": "评价57分，适用于大部分恐怖片。拥有微弱法力，有萨满祭司潜力。", "attrs": {"mus": 10, "ner": 10, "int": 20, "spi": 20, "cel": 0, "imm": 0}, "line": "custom_元素崇拜者血统", "tier": 0}, "见习德鲁伊血统": {"name": "见习德鲁伊血统", "branch": "D", "price": 500, "req": null, "desc": "评价69分，适用于大部分恐怖片。技能自然能量，可以学习和使用D级自然法术。", "attrs": {"mus": 10, "ner": 20, "int": 30, "spi": 20, "cel": 10, "imm": 10}, "line": "custom_见习德鲁伊血统", "tier": 0}, "德鲁伊血统": {"name": "德鲁伊血统", "branch": "C", "price": 1300, "req": "见习德鲁伊血统", "desc": "评价77分，适用于大部分恐怖片，技能自然能量，可以学习和使用C级自然法术。学习召唤类的自然法术后可以进行形态切换。", "attrs": {"mus": 30, "ner": 50, "int": 80, "spi": 60, "cel": 20, "imm": 20}, "line": "custom_德鲁伊血统", "tier": 0}, "德鲁伊长老血统": {"name": "德鲁伊长老血统", "branch": "B", "price": 2500, "req": "德鲁伊血统", "desc": "评价85分，适用于大部分恐怖片，技能自然能量，可以学习和使用B级自然法术。学习召唤类的自然法术后可以进行形态切换。", "attrs": {"mus": 50, "ner": 100, "int": 180, "spi": 120, "cel": 30, "imm": 30}, "line": "custom_德鲁伊长老血统", "tier": 0}, "大德鲁伊血统": {"name": "大德鲁伊血统", "branch": "A", "price": 5500, "req": "德鲁伊长老血统", "desc": "评价90分，适用于大部分恐怖片，技能自然能量，可以学习和使用A级和S级自然法术。学习召唤类的自然法术后可以进行形态切换。", "attrs": {"mus": 100, "ner": 250, "int": 400, "spi": 320, "cel": 50, "imm": 50}, "line": "custom_大德鲁伊血统", "tier": 0}, "巫血统": {"name": "巫血统", "branch": "D", "price": 500, "req": null, "desc": "评价75分，适用于大部分恐怖片。技能巫术，根据所选择的自然神灵（植物之神、狼神、风神等）获得一项随机能力。", "attrs": {"mus": 0, "ner": 0, "int": 0, "spi": 0, "cel": 0, "imm": 0}, "line": "custom_巫血统", "tier": 0}, "亡灵变异血统": {"name": "亡灵变异血统", "branch": "D", "price": 500, "req": null, "desc": "评价60分，适用于大部分恐怖片。技能亡灵之躯，免疫绝大部分精神法术和病毒，没有生命力或灵魂。因为是变异血统，所以没有亡灵的外貌，也不会惧怕白天、光明或神圣。", "attrs": {"mus": 30, "ner": 20, "int": 0, "spi": 0, "cel": 20, "imm": 10}, "line": "custom_亡灵变异血统", "tier": 0}, "亡灵法师变异血统": {"name": "亡灵法师变异血统", "branch": "C", "price": 900, "req": "亡灵变异血统", "desc": "评价74分，适用于大部分恐怖片。技能亡灵之躯和亡灵法术，只能释放亡灵法术。因为是变异血统，所以没有亡灵的外貌，也不会惧怕白天、光明或神圣。", "attrs": {"mus": 50, "ner": 30, "int": 10, "spi": 0, "cel": 30, "imm": 20}, "line": "custom_亡灵法师变异血统", "tier": 0}, "高阶亡灵法师变异血统": {"name": "高阶亡灵法师变异血统", "branch": "B", "price": 1500, "req": "亡灵法师变异血统", "desc": "评价85分，适用于大部分恐怖片。技能亡灵之躯和强化亡灵法术，只能释放亡灵法术但亡灵法术得到强化。因为是变异血统，所以没有亡灵的外貌，也不会惧怕白天、光明或神圣。", "attrs": {"mus": 80, "ner": 50, "int": 20, "spi": 0, "cel": 50, "imm": 30}, "line": "custom_高阶亡灵法师变异血统", "tier": 7}, "亡灵骑士变异血统": {"name": "亡灵骑士变异血统", "branch": "C", "price": 1500, "req": "亡灵变异血统", "desc": "评价77分，适用于需要近战的恐怖片。技能亡灵之躯和亡灵诅咒，近战攻击会附加亡灵诅咒。因为是变异血统，所以没有亡灵的外貌，也不会惧怕白天、光明或神圣。", "attrs": {"mus": 100, "ner": 80, "int": 0, "spi": 0, "cel": 50, "imm": 30}, "line": "custom_亡灵骑士变异血统", "tier": 0}, "高阶亡灵骑士变异血统": {"name": "高阶亡灵骑士变异血统", "branch": "B", "price": 5000, "req": "亡灵骑士变异血统", "desc": "评价89分，适用于需要近战的恐怖片。技能亡灵之躯和强化亡灵诅咒，近战攻击会附加亡灵诅咒，被你转变为亡灵的单位将受你控制。因为是变异血统，所以没有亡灵的外貌，也不会惧怕白天、光明或神圣。", "attrs": {"mus": 250, "ner": 200, "int": 0, "spi": 0, "cel": 150, "imm": 80}, "line": "custom_高阶亡灵骑士变异血统", "tier": 7}, "石像鬼变异血统": {"name": "石像鬼变异血统", "branch": "C", "price": 2000, "req": "亡灵变异血统", "desc": "评价75分，适用于大部分恐怖片。技能亡灵之躯和雕像形态，可以变为雕像形态，无法行动但是大幅度提高防御力和再生能力。因为是变异血统，所以没有亡灵的外貌，也不会惧怕白天、光明或神圣。", "attrs": {"mus": 80, "ner": 80, "int": 0, "spi": 0, "cel": 50, "imm": 50}, "line": "custom_石像鬼变异血统", "tier": 0}, "高阶石像鬼变异血统": {"name": "高阶石像鬼变异血统", "branch": "B", "price": 6000, "req": "石像鬼变异血统", "desc": "评价87分，适用于大部分恐怖片。技能亡灵之躯和强化雕像形态，可以变为雕像形态，行动缓慢但是大幅度提高防御力和再生能力。因为是变异血统，所以没有亡灵的外貌，也不会惧怕白天、光明或神圣。", "attrs": {"mus": 200, "ner": 200, "int": 0, "spi": 0, "cel": 150, "imm": 150}, "line": "custom_高阶石像鬼变异血统", "tier": 7}, "亡魂变异血统": {"name": "亡魂变异血统", "branch": "C", "price": 2500, "req": "亡灵变异血统", "desc": "评价78分，适用于大部分恐怖片。技能亡灵之躯和亡魂形态，肉体死亡后以灵魂状态继续战斗。因为是变异血统，所以没有亡灵的外貌，也不会惧怕白天、光明或神圣。", "attrs": {"mus": 50, "ner": 120, "int": 0, "spi": 20, "cel": 50, "imm": 20}, "line": "custom_亡魂变异血统", "tier": 0}, "不灭亡魂变异血统": {"name": "不灭亡魂变异血统", "branch": "B", "price": 4000, "req": "亡魂变异血统", "desc": "评价89分，适用于大部分恐怖片。技能亡灵之躯、亡魂形态和幽灵步，可以灵魂出窍进行战斗，幽灵步结束时肉体将传送至灵魂处。因为是变异血统，所以没有亡灵的外貌，也不会惧怕白天、光明或神圣。", "attrs": {"mus": 100, "ner": 250, "int": 0, "spi": 50, "cel": 100, "imm": 50}, "line": "custom_不灭亡魂变异血统", "tier": 0}, "食人族血统": {"name": "食人族血统", "branch": "D", "price": 200, "req": null, "desc": "评价50分，适用于大部分恐怖片。技能免疫库鲁病。", "attrs": {"mus": 10, "ner": 0, "int": 10, "spi": 0, "cel": 20, "imm": 30}, "line": "custom_食人族血统", "tier": 0}, "食尸鬼变异血统": {"name": "食尸鬼变异血统", "branch": "C", "price": 600, "req": "食人族血统", "desc": "评价74分，适用于大部分恐怖片。技能食尸，通过吞食尸体来恢复伤势并获得强化。因为是变异血统，所以没有食尸鬼的外貌、特征和弱点。", "attrs": {"mus": 30, "ner": 50, "int": 0, "spi": 0, "cel": 20, "imm": 30}, "line": "custom_食尸鬼变异血统", "tier": 0}, "狂热食尸鬼变异血统": {"name": "狂热食尸鬼变异血统", "branch": "B", "price": 1500, "req": "食尸鬼变异血统", "desc": "评价80分，适用于大部分恐怖片。技能食尸和食尸鬼狂热，可以在短时间内提高速度。因为是变异血统，所以没有食尸鬼的外貌、特征和弱点。", "attrs": {"mus": 60, "ner": 100, "int": 10, "spi": 10, "cel": 50, "imm": 60}, "line": "custom_狂热食尸鬼变异血统", "tier": 0}, "食尸鬼王变异血统": {"name": "食尸鬼王变异血统", "branch": "A", "price": 3000, "req": "狂热食尸鬼变异血统", "desc": "评价88分，适用于大部分恐怖片。技能食尸、食尸鬼狂热和食尸鬼爪，可以将手掌变为食尸鬼爪，食尸鬼爪在造成伤害的同时会恢复伤势。因为是变异血统，所以没有食尸鬼的外貌、特征和弱点。", "attrs": {"mus": 150, "ner": 200, "int": 20, "spi": 20, "cel": 100, "imm": 150}, "line": "custom_食尸鬼王变异血统", "tier": 0}, "初级牧师血统": {"name": "初级牧师血统", "branch": "D", "price": 500, "req": null, "desc": "评价69分，适用于需要辅助的恐怖片，拥有圣光能量的牧师。技能初级治疗增强，在使用治疗法术时效果更好", "attrs": {"mus": 0, "ner": 10, "int": 20, "spi": 50, "cel": 0, "imm": 0}, "line": "custom_初级牧师血统", "tier": 1}, "中级牧师血统": {"name": "中级牧师血统", "branch": "C", "price": 1000, "req": "初级牧师血统", "desc": "评价76分，适用于需要辅助的恐怖片，拥有圣光能量的牧师。技能中级治疗增强，在使用治疗法术时效果更好", "attrs": {"mus": 0, "ner": 20, "int": 50, "spi": 100, "cel": 0, "imm": 0}, "line": "custom_中级牧师血统", "tier": 2}, "高级牧师血统": {"name": "高级牧师血统", "branch": "B", "price": 2500, "req": "中级牧师血统", "desc": "评价84分，适用于需要辅助的恐怖片，拥有圣光能量的牧师。技能高级治疗增强，在使用治疗法术时效果更好", "attrs": {"mus": 0, "ner": 60, "int": 150, "spi": 300, "cel": 0, "imm": 0}, "line": "custom_高级牧师血统", "tier": 3}, "暗影牧师血统": {"name": "暗影牧师血统", "branch": "B", "price": 4000, "req": "中级牧师血统", "desc": "评价86分，适用于大部分恐怖片，能够在圣光能量和暗影能量间随时切换的牧师。", "attrs": {"mus": 50, "ner": 100, "int": 200, "spi": 250, "cel": 20, "imm": 20}, "line": "custom_暗影牧师血统", "tier": 0}, "圣光背叛者血统": {"name": "圣光背叛者血统", "branch": "B", "price": 8000, "req": "中级牧师血统", "desc": "评价89分，适用于大部分恐怖片，背叛了圣光转投暗影能量的牧师，能够释放出威力强大的暗影法术，所有圣光法术将会转变。", "attrs": {"mus": 100, "ner": 200, "int": 400, "spi": 300, "cel": 50, "imm": 50}, "line": "custom_圣光背叛者血统", "tier": 0}, "术士血统": {"name": "术士血统", "branch": "D", "price": 500, "req": null, "desc": "评价61分，适用于大部分恐怖片，拥有邪能的低级术士。", "attrs": {"mus": 0, "ner": 10, "int": 30, "spi": 50, "cel": 0, "imm": 0}, "line": "custom_术士血统", "tier": 0}, "高等术士血统": {"name": "高等术士血统", "branch": "C", "price": 1500, "req": "术士血统", "desc": "评价73分，适用于大部分恐怖片，技能邪能改造，用邪能短时间提升身体素质。", "attrs": {"mus": 0, "ner": 30, "int": 120, "spi": 100, "cel": 0, "imm": 0}, "line": "custom_高等术士血统", "tier": 0}, "暗影术士血统": {"name": "暗影术士血统", "branch": "B", "price": 4000, "req": "高等术士血统", "desc": "评价88分，适用于大部分恐怖片，技能强化邪能改造，用邪能短时间提升身体素质。可以在邪能和暗影能量间切换的术士。", "attrs": {"mus": 0, "ner": 80, "int": 300, "spi": 200, "cel": 0, "imm": 0}, "line": "custom_暗影术士血统", "tier": 0}, "恶魔术士血统": {"name": "恶魔术士血统", "branch": "B", "price": 8000, "req": "高等术士血统", "desc": "评价86分，适用于大部分恐怖片，技能恶魔亲和，获得恶魔的认可并提高召唤出的恶魔的能力。", "attrs": {"mus": 200, "ner": 150, "int": 400, "spi": 400, "cel": 0, "imm": 0}, "line": "custom_恶魔术士血统", "tier": 0}, "毁灭术士血统": {"name": "毁灭术士血统", "branch": "B", "price": 8000, "req": "高等术士血统", "desc": "评价91分，适用于大部分恐怖片，技能毁灭之力，法术能造成强力伤害。", "attrs": {"mus": 0, "ner": 100, "int": 300, "spi": 600, "cel": 0, "imm": 0}, "line": "custom_毁灭术士血统", "tier": 0}, "痛苦术士血统": {"name": "痛苦术士血统", "branch": "C", "price": 2000, "req": "术士血统", "desc": "评价76分，适用于大部分恐怖片，技能折磨，受伤越重法术效果越强", "attrs": {"mus": 50, "ner": 20, "int": 80, "spi": 100, "cel": 20, "imm": 20}, "line": "custom_痛苦术士血统", "tier": 0}, "憎恨术士血统": {"name": "憎恨术士血统", "branch": "B", "price": 4000, "req": "痛苦术士血统", "desc": "评价87分，适用于大部分恐怖片，技能强化折磨，受伤越重法术效果越强", "attrs": {"mus": 100, "ner": 40, "int": 150, "spi": 200, "cel": 50, "imm": 50}, "line": "custom_憎恨术士血统", "tier": 0}, "小恶魔变异血统": {"name": "小恶魔变异血统", "branch": "C", "price": 2000, "req": null, "desc": "评价71分，适用于大部分恐怖片，技能火焰能量可以使用部分火焰法术并对火焰免疫。因为是变异血统，所以不惧怕神圣和天使，也不服从于恶魔军团", "attrs": {"mus": 80, "ner": 40, "int": 0, "spi": 20, "cel": 60, "imm": 30}, "line": "custom_小恶魔变异血统", "tier": 0}, "大恶魔变异血统": {"name": "大恶魔变异血统", "branch": "B", "price": 4000, "req": "小恶魔变异血统", "desc": "评价80分，适用于大部分恐怖片，技能火焰能量可以使用部分火焰法术并对火焰免疫。因为是变异血统，所以不惧怕神圣和天使，也不服从于恶魔军团", "attrs": {"mus": 150, "ner": 100, "int": 20, "spi": 50, "cel": 120, "imm": 50}, "line": "custom_大恶魔变异血统", "tier": 0}, "魔王变异血统": {"name": "魔王变异血统", "branch": "A", "price": 7000, "req": "大恶魔变异血统", "desc": "评价89分，适用于大部分恐怖片，技能火焰能量可以使用部分火焰法术并对火焰免疫。因为是变异血统，所以不惧怕神圣和天使，也不服从于恶魔军团", "attrs": {"mus": 300, "ner": 200, "int": 50, "spi": 100, "cel": 250, "imm": 100}, "line": "custom_魔王变异血统", "tier": 0}, "魔神变异血统": {"name": "魔神变异血统", "branch": "S", "price": 12000, "req": "魔王变异血统", "desc": "评价96分，适用于大部分恐怖片，技能火焰能量可以使用所有火焰法术并对火焰免疫。因为是变异血统，所以不惧怕神圣和天使，也不服从于恶魔军团", "attrs": {"mus": 600, "ner": 450, "int": 100, "spi": 200, "cel": 500, "imm": 200}, "line": "custom_魔神变异血统", "tier": 0}, "魅魔变异血统": {"name": "魅魔变异血统", "branch": "B", "price": 8000, "req": "小恶魔变异血统", "desc": "评价86分，适用于大部分恐怖片，技能火焰能量和魅惑，可以魅惑智慧生物。因为是变异血统，所以不惧怕神圣和天使，也不服从于恶魔军团。", "attrs": {"mus": 150, "ner": 300, "int": 100, "spi": 500, "cel": 100, "imm": 60}, "line": "custom_魅魔变异血统", "tier": 0}, "信徒血统": {"name": "信徒血统", "branch": "D", "price": 500, "req": null, "desc": "评价64分，适用于有神灵的恐怖片，技能神契力，从神灵处获取神契力。", "attrs": {"mus": 20, "ner": 10, "int": 10, "spi": 40, "cel": 10, "imm": 30}, "line": "custom_信徒血统", "tier": 0}, "狂热信徒血统": {"name": "狂热信徒血统", "branch": "C", "price": 2000, "req": "信徒血统", "desc": "评价72分，适用于有神灵的恐怖片，技能神契力，从神灵处获取神契力。", "attrs": {"mus": 50, "ner": 30, "int": 20, "spi": 100, "cel": 40, "imm": 70}, "line": "custom_狂热信徒血统", "tier": 0}, "见习天使血统": {"name": "见习天使血统", "branch": "B", "price": 4500, "req": "狂热信徒血统", "desc": "评价83分，适用于有上帝的恐怖片，技能上帝契约，从上帝处获取神契力。", "attrs": {"mus": 80, "ner": 70, "int": 50, "spi": 200, "cel": 100, "imm": 150}, "line": "custom_见习天使血统", "tier": 0}, "小天使血统": {"name": "小天使血统", "branch": "A", "price": 8000, "req": "见习天使血统", "desc": "评价89分，适用于有上帝的恐怖片，技能上帝契约，从上帝处获取神契力。", "attrs": {"mus": 150, "ner": 120, "int": 100, "spi": 400, "cel": 200, "imm": 300}, "line": "custom_小天使血统", "tier": 0}, "大天使血统": {"name": "大天使血统", "branch": "AA", "price": 13000, "req": "小天使血统", "desc": "评价95分，适用于有上帝的恐怖片，技能上帝契约，从上帝处获取神契力。", "attrs": {"mus": 250, "ner": 200, "int": 180, "spi": 700, "cel": 350, "imm": 500}, "line": "custom_大天使血统", "tier": 0}, "堕落天使血统": {"name": "堕落天使血统", "branch": "AA", "price": 13000, "req": "大天使血统", "desc": "评价94分，适用于有撒旦的恐怖片，技能撒旦契约，从撒旦处获取神契力，且部分神契力法术改变。", "attrs": {"mus": 300, "ner": 300, "int": 250, "spi": 1000, "cel": 400, "imm": 800}, "line": "custom_堕落天使血统", "tier": 0}, "小天使变异血统": {"name": "小天使变异血统", "branch": "C", "price": 2000, "req": null, "desc": "评价78分，适用于对抗恶魔的恐怖片，拥有神契力的变异天使，技能神圣之力，免疫部分光系法术同时能对恶魔造成大量伤害。因为是变异血统，所以不需要遵守天堂戒律。", "attrs": {"mus": 40, "ner": 70, "int": 20, "spi": 100, "cel": 30, "imm": 50}, "line": "custom_小天使变异血统", "tier": 0}, "大天使变异血统": {"name": "大天使变异血统", "branch": "B", "price": 4000, "req": "小天使变异血统", "desc": "评价83分，适用于对抗恶魔的恐怖片，拥有神契力的变异天使，技能神圣之力，免疫部分光系法术同时能对恶魔造成大量伤害。因为是变异血统，所以不需要遵守天堂戒律。", "attrs": {"mus": 80, "ner": 150, "int": 50, "spi": 200, "cel": 50, "imm": 100}, "line": "custom_大天使变异血统", "tier": 0}, "天使长变异血统": {"name": "天使长变异血统", "branch": "A", "price": 7000, "req": "大天使变异血统", "desc": "评价89分，适用于对抗恶魔的恐怖片，拥有神契力的变异天使，技能神圣之力，免疫部分光系法术同时能对恶魔造成大量伤害。因为是变异血统，所以不需要遵守天堂戒律。", "attrs": {"mus": 150, "ner": 280, "int": 100, "spi": 400, "cel": 100, "imm": 200}, "line": "custom_天使长变异血统", "tier": 0}, "至高天使长变异血统": {"name": "至高天使长变异血统", "branch": "S", "price": 12000, "req": "天使长变异血统", "desc": "评价93分，适用于对抗恶魔的恐怖片，拥有神契力的变异天使，技能神圣之力，免疫部分光系法术同时能对恶魔造成大量伤害。因为是变异血统，所以不需要遵守天堂戒律。", "attrs": {"mus": 300, "ner": 550, "int": 200, "spi": 750, "cel": 200, "imm": 400}, "line": "custom_至高天使长变异血统", "tier": 0}, "裁决者血统": {"name": "裁决者血统", "branch": "D", "price": 1500, "req": null, "desc": "评价70分，适用于对抗邪恶的恐怖片，技能裁决，根据敌人罪恶程度短时间强化神契力。", "attrs": {"mus": 50, "ner": 50, "int": 20, "spi": 50, "cel": 20, "imm": 50}, "line": "custom_裁决者血统", "tier": 0}, "审判者血统": {"name": "审判者血统", "branch": "C", "price": 3500, "req": "裁决者血统", "desc": "评价78分，适用于对抗邪恶的恐怖片，技能审判，根据敌人罪恶程度造成伤害且短时间强化神契力。", "attrs": {"mus": 100, "ner": 100, "int": 50, "spi": 100, "cel": 50, "imm": 100}, "line": "custom_审判者血统", "tier": 0}, "法术初学者血统": {"name": "法术初学者血统", "branch": "D", "price": 800, "req": null, "desc": "评价65分，适用于大部分恐怖片，必须使用法杖施法的法师，技能法力之潮，短时间内强化法力。可以学习D级法术。", "attrs": {"mus": 0, "ner": 20, "int": 50, "spi": 50, "cel": 0, "imm": 0}, "line": "custom_法术初学者血统", "tier": 0}, "法术学徒血统": {"name": "法术学徒血统", "branch": "C", "price": 1200, "req": "法术初学者血统", "desc": "评价78分，适用于大部分恐怖片，必须使用法杖施法的法师，技能法力之潮，短时间内强化法力。可以学习C级法术。", "attrs": {"mus": 0, "ner": 30, "int": 70, "spi": 70, "cel": 0, "imm": 0}, "line": "custom_法术学徒血统", "tier": 0}, "法术专家血统": {"name": "法术专家血统", "branch": "B", "price": 3000, "req": "法术学徒血统", "desc": "评价90分，适用于大部分恐怖片，必须使用法杖施法的法师，技能法力之潮，短时间内强化法力。可以学习B级法术。", "attrs": {"mus": 0, "ner": 50, "int": 150, "spi": 150, "cel": 0, "imm": 0}, "line": "custom_法术专家血统", "tier": 0}, "大法师血统": {"name": "大法师血统", "branch": "A", "price": 5000, "req": "法术专家血统", "desc": "评价98分，适用于大部分恐怖片，必须使用法杖施法的法师，技能法力之潮，短时间内强化法力。可以学习A级和S级法术。", "attrs": {"mus": 0, "ner": 100, "int": 300, "spi": 300, "cel": 0, "imm": 0}, "line": "custom_大法师血统", "tier": 0}, "骑兵血统": {"name": "骑兵血统", "branch": "2D", "price": 400, "req": "见习士兵血统", "desc": "评价73分，适用于需要近战的恐怖片。技能骑乘，可以骑乘常见生物。", "attrs": {"mus": 50, "ner": 50, "int": 0, "spi": 0, "cel": 20, "imm": 10}, "line": "custom_骑兵血统", "tier": 0}, "轻骑兵血统": {"name": "轻骑兵血统", "branch": "C", "price": 1200, "req": "骑兵血统", "desc": "评价79分，适用于需要近战的恐怖片。技能骑乘和骑乘冲锋，短时间大幅度提高坐骑移动速度。", "attrs": {"mus": 120, "ner": 120, "int": 0, "spi": 0, "cel": 30, "imm": 30}, "line": "custom_轻骑兵血统", "tier": 0}, "重骑兵血统": {"name": "重骑兵血统", "branch": "C", "price": 1500, "req": "骑兵血统", "desc": "评价81分，适用于需要近战的恐怖片。技能骑乘和骑乘防御，短时间提高自身和坐骑防御力。", "attrs": {"mus": 180, "ner": 80, "int": 0, "spi": 0, "cel": 40, "imm": 40}, "line": "custom_重骑兵血统", "tier": 0}, "骑士血统": {"name": "骑士血统", "branch": "C", "price": 1200, "req": "骑兵血统", "desc": "评价84分，适用于大部分恐怖片。技能强化骑乘，可以骑乘大部分生物。", "attrs": {"mus": 80, "ner": 80, "int": 30, "spi": 30, "cel": 20, "imm": 20}, "line": "custom_骑士血统", "tier": 0}, "神话骑士血统": {"name": "神话骑士血统", "branch": "B", "price": 6000, "req": "骑士血统", "desc": "评价88分，适用于大部分恐怖片。技能神话骑乘，可以骑乘并驯服神话生物", "attrs": {"mus": 300, "ner": 300, "int": 200, "spi": 200, "cel": 200, "imm": 200}, "line": "custom_神话骑士血统", "tier": 0}, "见习圣骑士血统": {"name": "见习圣骑士血统", "branch": "D", "price": 100, "req": null, "desc": "评价65分，适用于需要坚定意志的恐怖片。需要遵守八美德且按信仰行事的传统圣骑士。", "attrs": {"mus": 30, "ner": 20, "int": 0, "spi": 10, "cel": 20, "imm": 10}, "line": "custom_见习圣骑士血统", "tier": 0}, "普通圣骑士血统": {"name": "普通圣骑士血统", "branch": "C", "price": 500, "req": "见习圣骑士血统", "desc": "评价70分，适用于需要坚定意志的恐怖片。需要遵守八美德且按信仰行\n事的传统圣骑士，技能初级信仰之力可以提高自己对精神系攻击的防御力。", "attrs": {"mus": 70, "ner": 50, "int": 10, "spi": 30, "cel": 40, "imm": 20}, "line": "custom_普通圣骑士血统", "tier": 0}, "狂热圣骑士血统": {"name": "狂热圣骑士血统", "branch": "B", "price": 1000, "req": "普通圣骑士血统", "desc": "评价77分，适用于需要坚定意志的恐怖片。需要遵守八美德且按信仰行事的传统圣骑士，技能中级信仰之力可以提高自己对精神系攻击的防御力且提高对战邪恶生物时的能力。", "attrs": {"mus": 120, "ner": 80, "int": 30, "spi": 50, "cel": 60, "imm": 40}, "line": "custom_狂热圣骑士血统", "tier": 0}, "美德骑士血统": {"name": "美德骑士血统", "branch": "A", "price": 2000, "req": "狂热圣骑士血统", "desc": "评价90分，适用于需要坚定意志的恐怖片。需要遵守八美德且按信仰行事的传统圣骑士，技能高级信仰之力可以提高自己对精神系攻击的防御力且提高对战邪恶生物时的能力，对你进行精神攻击的敌人会受到你坚定信仰的反击", "attrs": {"mus": 200, "ner": 120, "int": 60, "spi": 80, "cel": 100, "imm": 80}, "line": "custom_美德骑士血统", "tier": 0}, "神圣骑士血统": {"name": "神圣骑士血统", "branch": "A", "price": 4000, "req": "狂热圣骑士血统", "desc": "评价93分，适用于大部分恐怖片。需要遵守八美德且按信仰行事的圣骑士，受到了神的祝福。技能中级信仰之力和骑士光芒，可以学习圣光法术并用体力释放。", "attrs": {"mus": 250, "ner": 200, "int": 100, "spi": 150, "cel": 150, "imm": 100}, "line": "custom_神圣骑士血统", "tier": 0}, "初级圣骑士变异血统": {"name": "初级圣骑士变异血统", "branch": "D", "price": 1200, "req": null, "desc": "评价72分，适用于需要近战的恐怖片。拥有初级圣光能量的圣骑士。因为是变异血统，所以不需要按照八美德和信仰行事。", "attrs": {"mus": 50, "ner": 20, "int": 10, "spi": 20, "cel": 30, "imm": 10}, "line": "custom_初级圣骑士变异血统", "tier": 1}, "中级圣骑士变异血统": {"name": "中级圣骑士变异血统", "branch": "C", "price": 2400, "req": "初级圣骑士变异血统", "desc": "评价80分，适用于需要近战的恐怖片。拥有中级圣光能量的圣骑士。因为是变异血统，所以不需要按照八美德和信仰行事。", "attrs": {"mus": 120, "ner": 50, "int": 20, "spi": 50, "cel": 70, "imm": 30}, "line": "custom_中级圣骑士变异血统", "tier": 2}, "高级圣骑士变异血统": {"name": "高级圣骑士变异血统", "branch": "B", "price": 4800, "req": "中级圣骑士变异血统", "desc": "评价88分，适用于需要近战的恐怖片中。拥有高级圣光能量的圣骑士。因为是变异血统，所以不需要按照八美德和信仰行事。", "attrs": {"mus": 200, "ner": 100, "int": 50, "spi": 100, "cel": 150, "imm": 50}, "line": "custom_高级圣骑士变异血统", "tier": 3}, "圣战骑士变异血统": {"name": "圣战骑士变异血统", "branch": "A", "price": 9600, "req": "高级圣骑士变异血统", "desc": "评价96分，适用于需要近战的恐怖片中。技能圣战，短时间大幅度提高对所有攻击的防御力且持续恢复伤势。因为是变异血统，所以不需要按照八美德和信仰行事。", "attrs": {"mus": 500, "ner": 200, "int": 100, "spi": 200, "cel": 300, "imm": 100}, "line": "custom_圣战骑士变异血统", "tier": 0}, "罪孽启迪者血统": {"name": "罪孽启迪者血统", "branch": "2D", "price": 700, "req": null, "desc": "评价67分，适用于大部分恐怖片。技能罪孽启迪，可以感知到别人的罪孽并且降低自身的罪恶感。", "attrs": {"mus": 20, "ner": 20, "int": 10, "spi": 50, "cel": 20, "imm": 30}, "line": "custom_罪孽启迪者血统", "tier": 0}, "绝望化身血统": {"name": "绝望化身血统", "branch": "2C", "price": 2500, "req": "罪孽启迪者血统", "desc": "评价82分，适用于大部分恐怖片。技能绝望吸收，周围的生灵越是绝望自己的力量就越强大。", "attrs": {"mus": 60, "ner": 60, "int": 40, "spi": 200, "cel": 50, "imm": 100}, "line": "custom_绝望化身血统", "tier": 0}, "原罪化身血统": {"name": "原罪化身血统", "branch": "2B", "price": 8000, "req": "绝望化身血统", "desc": "评价92分，适用于大部分恐怖片。技能原罪化身，罪恶将会为你提供永久的力量。", "attrs": {"mus": 200, "ner": 200, "int": 100, "spi": 700, "cel": 200, "imm": 300}, "line": "custom_原罪化身血统", "tier": 0}, "幸存者血统": {"name": "幸存者血统", "branch": "D", "price": 800, "req": null, "desc": "评价72分，适用于大部分恐怖片中。技能幸存者，本场恐怖片中己方小队死亡人数越多战斗力越强。", "attrs": {"mus": 30, "ner": 20, "int": 20, "spi": 10, "cel": 30, "imm": 20}, "line": "custom_幸存者血统", "tier": 0}, "团队之星血统": {"name": "团队之星血统", "branch": "C", "price": 2000, "req": "幸存者血统", "desc": "评价81分，适用于大部分恐怖片中。技能幸存者和团队之星光环，能够小幅提高周围盟友的速度。", "attrs": {"mus": 50, "ner": 30, "int": 40, "spi": 70, "cel": 50, "imm": 50}, "line": "custom_团队之星血统", "tier": 0}, "领袖血统": {"name": "领袖血统", "branch": "B", "price": 4000, "req": "团队之星血统", "desc": "评价86分，适用于大部分恐怖片中。技能幸存者和领袖光环，能够提高周围盟友的速度和防御力。", "attrs": {"mus": 80, "ner": 50, "int": 70, "spi": 120, "cel": 80, "imm": 80}, "line": "custom_领袖血统", "tier": 0}, "救世主血统": {"name": "救世主血统", "branch": "A", "price": 8000, "req": "领袖血统", "desc": "评价91分，适用于大部分恐怖片中。技能幸存者、领袖光环和救世之武，可以将渴望拯救世界之人的信念化为武器。", "attrs": {"mus": 150, "ner": 100, "int": 120, "spi": 300, "cel": 150, "imm": 150}, "line": "custom_救世主血统", "tier": 0}, "独狼血统": {"name": "独狼血统", "branch": "C", "price": 1500, "req": "幸存者血统", "desc": "评价79分，适用于大部分恐怖片。技能独狼，在附近没有己方小队成员时获得敏锐的感知能力。", "attrs": {"mus": 80, "ner": 60, "int": 30, "spi": 30, "cel": 60, "imm": 50}, "line": "custom_独狼血统", "tier": 0}, "孤胆英雄血统": {"name": "孤胆英雄血统", "branch": "B", "price": 4500, "req": "独狼血统", "desc": "评价84分，适用于大部分恐怖片。技能独狼和孤胆英雄，附近没有己方小队成员时可以在短时间内进入孤胆英雄状态。", "attrs": {"mus": 180, "ner": 150, "int": 80, "spi": 80, "cel": 150, "imm": 120}, "line": "custom_孤胆英雄血统", "tier": 0}, "天煞孤星血统": {"name": "天煞孤星血统", "branch": "A", "price": 9000, "req": "孤胆英雄血统", "desc": "评价89分，适用于大部分恐怖片。技能独狼、孤胆英雄和天煞孤星，会给亲近之人带来血光之灾，被你克死之人会增加你的战斗力。", "attrs": {"mus": 350, "ner": 280, "int": 150, "spi": 150, "cel": 280, "imm": 200}, "line": "custom_天煞孤星血统", "tier": 0}, "初级抗争者血统": {"name": "初级抗争者血统", "branch": "D", "price": 500, "req": null, "desc": "评价66分，适用于大部分恐怖片。技能初级抗争，重伤或面对强敌时小幅度提升战斗力。", "attrs": {"mus": 30, "ner": 20, "int": 10, "spi": 10, "cel": 10, "imm": 10}, "line": "custom_初级抗争者血统", "tier": 1}, "中级抗争者血统": {"name": "中级抗争者血统", "branch": "C", "price": 1000, "req": "初级抗争者血统", "desc": "评价70分，适用于大部分恐怖片。技能中级抗争，重伤或面对强敌时中幅度提升战斗力。", "attrs": {"mus": 50, "ner": 30, "int": 20, "spi": 20, "cel": 20, "imm": 20}, "line": "custom_中级抗争者血统", "tier": 2}, "高级抗争者血统": {"name": "高级抗争者血统", "branch": "B", "price": 2000, "req": "中级抗争者血统", "desc": "评价77分，适用于大部分恐怖片。技能高级抗争，重伤或面对强敌时大幅度提升战斗力。", "attrs": {"mus": 80, "ner": 50, "int": 30, "spi": 30, "cel": 30, "imm": 30}, "line": "custom_高级抗争者血统", "tier": 3}, "自由斗士血统": {"name": "自由斗士血统", "branch": "A", "price": 2000, "req": "高级抗争者血统", "desc": "评价87分，适用于大部分恐怖片。技能高级抗争和自由斗士，为了自由而战会永久提高高级抗争的战斗力加成。", "attrs": {"mus": 120, "ner": 100, "int": 40, "spi": 40, "cel": 40, "imm": 40}, "line": "custom_自由斗士血统", "tier": 0}, "不屈者血统": {"name": "不屈者血统", "branch": "A", "price": 2000, "req": "高级抗争者血统", "desc": "评价89分，适用于大部分恐怖片。技能高级抗争和不屈，短时间内难以被杀死。", "attrs": {"mus": 250, "ner": 100, "int": 30, "spi": 30, "cel": 30, "imm": 30}, "line": "custom_不屈者血统", "tier": 0}, "呐喊者血统": {"name": "呐喊者血统", "branch": "A", "price": 3000, "req": "高级抗争者血统", "desc": "评价88分，适用于大部分恐怖片。技能高级抗争和呐喊，在绝境时呐喊来获得强大的战斗力。", "attrs": {"mus": 150, "ner": 120, "int": 50, "spi": 50, "cel": 50, "imm": 50}, "line": "custom_呐喊者血统", "tier": 0}, "复仇者血统": {"name": "复仇者血统", "branch": "A", "price": 3000, "req": "高级抗争者血统", "desc": "评价90分，适用于大部分恐怖片。技能高级抗争和复仇化身，暂时变为复仇化身。", "attrs": {"mus": 100, "ner": 100, "int": 100, "spi": 100, "cel": 100, "imm": 100}, "line": "custom_复仇者血统", "tier": 0}, "暗影抗争者血统": {"name": "暗影抗争者血统", "branch": "A", "price": 4000, "req": "高级抗争者血统", "desc": "评价87分，适用于大部分恐怖片。技能高级抗争。拥有暗影能量的抗争者。", "attrs": {"mus": 100, "ner": 150, "int": 200, "spi": 200, "cel": 50, "imm": 50}, "line": "custom_暗影抗争者血统", "tier": 0}, "鬼魂克星血统": {"name": "鬼魂克星血统", "branch": "D", "price": 2000, "req": null, "desc": "评价58分，适用于灵异类恐怖片，能够看到鬼魂并且举手投足之间都能对鬼魂或灵体造成极大伤害。", "attrs": {"mus": 0, "ner": 0, "int": 0, "spi": 0, "cel": 0, "imm": 0}, "line": "custom_鬼魂克星血统", "tier": 0}, "养殖者克星血统": {"name": "养殖者克星血统", "branch": "D", "price": 1000, "req": null, "desc": "评价32分，适用于对战养殖者小队的团战中，在对战养殖者小队时能够发挥出最大潜力。", "attrs": {"mus": 0, "ner": 0, "int": 0, "spi": 0, "cel": 0, "imm": 0}, "line": "custom_养殖者克星血统", "tier": 0}, "受虐血统": {"name": "受虐血统", "branch": "C", "price": 3000, "req": null, "desc": "评价64分，适用于挑战极限的轮回者，在脱离濒死状态时会大幅度提升身体素质。", "attrs": {"mus": 0, "ner": 0, "int": 0, "spi": 0, "cel": 0, "imm": 0}, "line": "custom_受虐血统", "tier": 0}, "机器改造血统": {"name": "机器改造血统", "branch": "C", "price": 2000, "req": null, "desc": "评价80分，适用于大部分恐怖片，技能机器改造，将大脑外的所有组织替换成机器，可以改造或加装科技类武器", "attrs": {"mus": 300, "ner": 200, "int": 0, "spi": 0, "cel": 0, "imm": 0}, "line": "custom_机器改造血统", "tier": 0}, "奥术师血统": {"name": "奥术师血统", "branch": "C", "price": 1000, "req": null, "desc": "评价85分，适用于大部分恐怖片，仅能学习奥术魔法的法师。技能冥想，缓慢的恢复法力并提高法力上限。", "attrs": {"mus": 20, "ner": 30, "int": 50, "spi": 50, "cel": 20, "imm": 10}, "line": "custom_奥术师血统", "tier": 0}, "近战射手血统": {"name": "近战射手血统", "branch": "C", "price": 3000, "req": null, "desc": "评价79分，适用于大部分恐怖片。技能穿心箭，集中全身力气射出一箭，距离越近伤害越高，可以射出普通弓箭三倍以下威力。使用之后会有十分钟的软弱无力，但能够爆发出恐怖的瞬间杀伤力。", "attrs": {"mus": 150, "ner": 100, "int": 50, "spi": 30, "cel": 30, "imm": 80}, "line": "custom_近战射手血统", "tier": 0}, "狙击射手血统": {"name": "狙击射手血统", "branch": "C", "price": 3000, "req": null, "desc": "评价79分，适用于大部分恐怖片。技能狙击箭，集中全身力气射出一箭，距离越远伤害越高，可以射出普通弓箭五倍以下威力。使用之后会有十分钟的软弱无力，但能够爆发出恐怖的瞬间爆发力。", "attrs": {"mus": 100, "ner": 150, "int": 50, "spi": 30, "cel": 30, "imm": 80}, "line": "custom_狙击射手血统", "tier": 0}, "乌鸦侦测者血统": {"name": "乌鸦侦测者血统", "branch": "C", "price": 1200, "req": null, "desc": "评价81分，适用于大部分恐怖片。技能乌鸦形态，大幅度增加视野范围。", "attrs": {"mus": 50, "ner": 100, "int": 20, "spi": 80, "cel": 30, "imm": 20}, "line": "custom_乌鸦侦测者血统", "tier": 0}, "血魔法师血统": {"name": "血魔法师血统", "branch": "B", "price": 3000, "req": null, "desc": "评价85分，适用于大部分恐怖片。技能储存生命能量，可以将自己作为容器储存无尽的生命能量。", "attrs": {"mus": 50, "ner": 50, "int": 100, "spi": 100, "cel": 300, "imm": 50}, "line": "custom_血魔法师血统", "tier": 0}, "破法者血统": {"name": "破法者血统", "branch": "B", "price": 2000, "req": null, "desc": "评价86分，适用于需要对抗法师的恐怖片，技能魔法免疫，能够免疫大部分魔法。", "attrs": {"mus": 50, "ner": 100, "int": 20, "spi": 100, "cel": 20, "imm": 20}, "line": "custom_破法者血统", "tier": 0}, "塔罗牌占卜师血统": {"name": "塔罗牌占卜师血统", "branch": "D", "price": 500, "req": null, "desc": "评价60分，适用于大部分恐怖片，技能塔罗牌占卜，能够用塔罗牌进行占卜", "attrs": {"mus": 0, "ner": 30, "int": 50, "spi": 80, "cel": 0, "imm": 0}, "line": "custom_塔罗牌占卜师血统", "tier": 0}, "塔罗牌魔法师血统": {"name": "塔罗牌魔法师血统", "branch": "C", "price": 1500, "req": "塔罗牌占卜师血统", "desc": "评价72分，适用于大部分恐怖片，技能塔罗牌魔法，能够用塔罗牌进行占卜，同时可以控制塔罗牌", "attrs": {"mus": 0, "ner": 80, "int": 120, "spi": 200, "cel": 0, "imm": 0}, "line": "custom_塔罗牌魔法师血统", "tier": 0}, "初级武器操纵师血统": {"name": "初级武器操纵师血统", "branch": "C", "price": 2000, "req": null, "desc": "评价72分，适用于大部分恐怖片。技能初级武器操纵，可以用意念操纵一个武器，武器无法离开你5米范围。", "attrs": {"mus": 20, "ner": 50, "int": 30, "spi": 80, "cel": 20, "imm": 10}, "line": "custom_初级武器操纵师血统", "tier": 1}, "中级武器操纵师血统": {"name": "中级武器操纵师血统", "branch": "B", "price": 4000, "req": "初级操纵师血统", "desc": "评价78分，适用于大部分恐怖片。技能中级武器操纵，可以用意念操纵三个武器，武器无法离开你20米范围。", "attrs": {"mus": 50, "ner": 100, "int": 60, "spi": 200, "cel": 50, "imm": 30}, "line": "custom_中级武器操纵师血统", "tier": 2}, "高级武器操纵师血统": {"name": "高级武器操纵师血统", "branch": "A", "price": 8000, "req": "中级操纵师血统", "desc": "评价86分，适用于大部分恐怖片。技能高级武器操纵，可以用意念操纵五个武器，武器无法离开你100米范围。", "attrs": {"mus": 100, "ner": 200, "int": 150, "spi": 400, "cel": 100, "imm": 60}, "line": "custom_高级武器操纵师血统", "tier": 3}, "武器操纵之王血统": {"name": "武器操纵之王血统", "branch": "AA", "price": 15000, "req": "高级操纵师血统", "desc": "评价93分，适用于大部分恐怖片。技能无限武器操纵，可以用意念操纵武器", "attrs": {"mus": 200, "ner": 400, "int": 300, "spi": 800, "cel": 200, "imm": 150}, "line": "custom_武器操纵之王血统", "tier": 0}, "剑术师模板": {"name": "剑术师模板", "branch": "C", "price": 1600, "req": null, "desc": "剑术师精通各种单手利刃，不论这些武器是匕首还是长剑，亦或者是盾牌。", "attrs": {}, "line": "custom_剑术师模板", "tier": 0}, "格斗家模板": {"name": "格斗家模板", "branch": "C", "price": 1600, "req": null, "desc": "格斗家的修行之路就是不间断的训练，他们的最终目标则是掌握传统的近战技巧。", "attrs": {}, "line": "custom_格斗家模板", "tier": 0}, "弓箭手模板": {"name": "弓箭手模板", "branch": "C", "price": 1600, "req": null, "desc": "弓箭手不断评估战场环境，选择最有利的站位，同时根据敌人的类型选择最适合的箭杆、箭头和尾羽。", "attrs": {}, "line": "custom_弓箭手模板", "tier": 0}, "幻术师模板": {"name": "幻术师模板", "branch": "C", "price": 1600, "req": null, "desc": "幻术能召唤地、风和水的元素，并将元素集中成强大的力量，以此为基础编织魔法。", "attrs": {}, "line": "custom_幻术师模板", "tier": 0}, "咒术师模板": {"name": "咒术师模板", "branch": "C", "price": 1600, "req": null, "desc": "咒术在娴熟的运用者手中是可怕的毁灭之力。咒术学派的核心是通过深刻的内省来召唤并控制个体内部潜在的以太之力。", "attrs": {}, "line": "custom_咒术师模板", "tier": 0}, "秘术师模板": {"name": "秘术师模板", "branch": "C", "price": 1600, "req": null, "desc": "秘术之道的研习者学习从南海另一边传来的秘法，用几何学技巧从符号中获得力量。秘术师的神秘魔法书中记载的符号能让他们塑造自己的以太，从而制造出各种强大的法术。", "attrs": {}, "line": "custom_秘术师模板", "tier": 0}, "结晶组合者血统": {"name": "结晶组合者血统", "branch": "C", "price": 4000, "req": null, "desc": "评价70分，适用于大部分恐怖片。技能结晶组合法术，将不同性质的结晶/能量石/符文组合来释放法术。", "attrs": {"mus": 50, "ner": 150, "int": 150, "spi": 150, "cel": 50, "imm": 50}, "line": "custom_结晶组合者血统", "tier": 0}, "结晶召唤者血统": {"name": "结晶召唤者血统", "branch": "C", "price": 4000, "req": null, "desc": "评价70分，适用于大部分恐怖片。技能结晶组合召唤，将不同性质的结晶/能量石/符文组合来进行召唤。", "attrs": {"mus": 50, "ner": 150, "int": 150, "spi": 150, "cel": 50, "imm": 50}, "line": "custom_结晶召唤者血统", "tier": 0}, "上尉血统": {"name": "上尉血统", "branch": "D", "price": 500, "req": null, "desc": "评价62分，适用于战争类恐怖片。技能指挥，能够为周围被你指挥的单位添加特殊效果。", "attrs": {"mus": 30, "ner": 20, "int": 20, "spi": 10, "cel": 20, "imm": 10}, "line": "custom_上尉血统", "tier": 0}, "指挥官血统": {"name": "指挥官血统", "branch": "C", "price": 1000, "req": "上尉血统", "desc": "评价70分，适用于战争类恐怖片。技能指挥，能够为小范围被你指挥的单位添加特殊效果。", "attrs": {"mus": 50, "ner": 40, "int": 40, "spi": 20, "cel": 40, "imm": 20}, "line": "custom_指挥官血统", "tier": 0}, "将军血统": {"name": "将军血统", "branch": "B", "price": 2500, "req": "指挥官血统", "desc": "评价79分，适用于战争类恐怖片。技能指挥，能够为大范围被你指挥的单位添加特殊效果。", "attrs": {"mus": 120, "ner": 80, "int": 80, "spi": 50, "cel": 80, "imm": 50}, "line": "custom_将军血统", "tier": 0}, "元帅血统": {"name": "元帅血统", "branch": "A", "price": 5000, "req": "将军血统", "desc": "评价89分，适用于战争类恐怖片。技能指挥，能够为所有被你指挥的单位添加特殊效果。", "attrs": {"mus": 250, "ner": 150, "int": 150, "spi": 100, "cel": 150, "imm": 100}, "line": "custom_元帅血统", "tier": 0}, "血脉术士模板": {"name": "血脉术士模板", "branch": "B", "price": 5000, "req": "任意血统", "desc": "深度开发已有血统潜力的职业模板，根据兑换者血统不同，可开发出的能力也天差地别。注：过度开发可能使远古基因暴走", "attrs": {}, "line": "custom_血脉术士模板", "tier": 0}, "低阶守护者血统": {"name": "低阶守护者血统", "branch": "D", "price": 600, "req": null, "desc": "评价72分，适用于大部分恐怖片。技能低阶防之守护，每次恐怖片开始时可以指定一个队友，小幅度提高其防御力。", "attrs": {"mus": 40, "ner": 20, "int": 10, "spi": 10, "cel": 10, "imm": 10}, "line": "custom_低阶守护者血统", "tier": 5}, "中阶守护者血统": {"name": "中阶守护者血统", "branch": "C", "price": 1500, "req": null, "desc": "评价72分，适用于大部分恐怖片。技能中阶防之守护，每次恐怖片开始时可以指定一个队友，中幅度提高其防御力。", "attrs": {"mus": 100, "ner": 50, "int": 30, "spi": 30, "cel": 30, "imm": 30}, "line": "custom_中阶守护者血统", "tier": 6}, "高阶守护者血统": {"name": "高阶守护者血统", "branch": "B", "price": 4000, "req": null, "desc": "评价72分，适用于大部分恐怖片。技能高阶防之守护，每次恐怖片开始时可以指定一个队友，大幅度提高其防御力。", "attrs": {"mus": 300, "ner": 150, "int": 100, "spi": 100, "cel": 100, "imm": 100}, "line": "custom_高阶守护者血统", "tier": 7}, "传奇守护者血统": {"name": "传奇守护者血统", "branch": "A", "price": 10000, "req": null, "desc": "评价72分，适用于大部分恐怖片。技能传奇防之守护，每次恐怖片开始时可以指定一个队友，极大幅度提高其防御力。", "attrs": {"mus": 800, "ner": 400, "int": 200, "spi": 200, "cel": 200, "imm": 200}, "line": "custom_传奇守护者血统", "tier": 0}, "歌颂者血统": {"name": "歌颂者血统", "branch": "D", "price": 600, "req": null, "desc": "评价62分，适用于大部分恐怖片。技能歌颂，通过唱出动听的歌曲来为周围生物恢复少许能量。", "attrs": {"mus": 10, "ner": 20, "int": 10, "spi": 30, "cel": 40, "imm": 20}, "line": "custom_歌颂者血统", "tier": 0}, "高级歌颂者血统": {"name": "高级歌颂者血统", "branch": "C", "price": 1500, "req": "歌颂者血统", "desc": "评价70分，适用于大部分恐怖片。技能高级歌颂，通过唱出动听的歌曲来为周围生物恢复能量。", "attrs": {"mus": 20, "ner": 50, "int": 30, "spi": 70, "cel": 100, "imm": 50}, "line": "custom_高级歌颂者血统", "tier": 3}, "灵魂歌者血统": {"name": "灵魂歌者血统", "branch": "B", "price": 3000, "req": "高级歌颂者血统", "desc": "评价82分，适用于大部分恐怖片。技能灵魂之歌，通过唱出不同的歌曲来影响周围所有生物。", "attrs": {"mus": 50, "ner": 100, "int": 60, "spi": 150, "cel": 200, "imm": 100}, "line": "custom_灵魂歌者血统", "tier": 0}, "死亡之歌血统": {"name": "死亡之歌血统", "branch": "B", "price": 6000, "req": "高级歌颂者血统", "desc": "评价87分，适用大部分恐怖片。技能死亡之歌，通过唱歌来令大范围的生物持续受到伤害。", "attrs": {"mus": 100, "ner": 150, "int": 80, "spi": 300, "cel": 300, "imm": 150}, "line": "custom_死亡之歌血统", "tier": 0}, "魅惑之歌血统": {"name": "魅惑之歌血统", "branch": "B", "price": 6000, "req": "高级歌颂者血统", "desc": "评价88分，适用于大部分恐怖片。技能魅惑之歌，通过唱歌来进行大范围的精神控制，没有被控制的生物也会出现不同程度的昏厥。", "attrs": {"mus": 60, "ner": 80, "int": 50, "spi": 500, "cel": 100, "imm": 50}, "line": "custom_魅惑之歌血统", "tier": 0}, "夺魂者血统": {"name": "夺魂者血统", "branch": "2C", "price": 2000, "req": null, "desc": "评价81分，适用于大部分恐怖片。技能夺魂，抽取目标灵魂来强化自己，对灵类生物特别有效。", "attrs": {"mus": 30, "ner": 30, "int": 30, "spi": 60, "cel": 30, "imm": 30}, "line": "custom_夺魂者血统", "tier": 0}, "摄魂者血统": {"name": "摄魂者血统", "branch": "B", "price": 4000, "req": "夺魂者血统", "desc": "评价87分，适用于大部分恐怖片。技能摄魂，抽取目标灵魂来强化自己，对灵类生物和信念不坚定者特别有效。", "attrs": {"mus": 60, "ner": 60, "int": 60, "spi": 120, "cel": 60, "imm": 60}, "line": "custom_摄魂者血统", "tier": 0}, "噬魂者血统": {"name": "噬魂者血统", "branch": "2B", "price": 6000, "req": "摄魂者血统", "desc": "评价92分，适用于大部分恐怖片。技能噬魂，抽取目标灵魂来强化自己，对灵类生物、信念不坚定者、灵魂强度低者特别有效。", "attrs": {"mus": 100, "ner": 100, "int": 100, "spi": 200, "cel": 100, "imm": 100}, "line": "custom_噬魂者血统", "tier": 0}, "观星者血统": {"name": "观星者血统", "branch": "D", "price": 500, "req": null, "desc": "评价67分，适用于大部分恐怖片。技能观星，通过观星来占卜凶吉、预测天气及预知发生的事。", "attrs": {"mus": 0, "ner": 0, "int": 60, "spi": 30, "cel": 0, "imm": 0}, "line": "custom_观星者血统", "tier": 0}, "预知者血统": {"name": "预知者血统", "branch": "C", "price": 1500, "req": "观星者血统", "desc": "评价73分，适用于大部分恐怖片。技能预知，能够预知到未来的一些片段。", "attrs": {"mus": 0, "ner": 0, "int": 200, "spi": 80, "cel": 0, "imm": 0}, "line": "custom_预知者血统", "tier": 0}, "观测者血统": {"name": "观测者血统", "branch": "B", "price": 4000, "req": "预知者血统", "desc": "评价88分，适用于大部分恐怖片。技能时间观测，可以观测时间线上发生的事情，也可以预知未来三秒内发生的事。", "attrs": {"mus": 0, "ner": 0, "int": 500, "spi": 200, "cel": 0, "imm": 0}, "line": "custom_观测者血统", "tier": 0}, "织梦者血统": {"name": "织梦者血统", "branch": "D", "price": 500, "req": null, "desc": "评价69分，适用于大部分恐怖片。技能织梦，能够近距离使一个睡着的生物做你指定的梦，对精神力比你强大者无效。", "attrs": {"mus": 0, "ner": 0, "int": 0, "spi": 100, "cel": 0, "imm": 0}, "line": "custom_织梦者血统", "tier": 0}, "梦魇血统": {"name": "梦魇血统", "branch": "C", "price": 1500, "req": "织梦者血统", "desc": "评价79分，适用于大部分恐怖片。技能中级织梦和梦魇，可以远距离织梦，且可以在你编织的梦中进行精神攻击。", "attrs": {"mus": 0, "ner": 0, "int": 0, "spi": 300, "cel": 0, "imm": 0}, "line": "custom_梦魇血统", "tier": 0}, "真实梦魇血统": {"name": "真实梦魇血统", "branch": "B", "price": 4000, "req": "梦魇血统", "desc": "评价90分，适用于大部分恐怖片。技能高级织梦和真实梦魇。现实和梦境的区别开始变得模糊，可以令清醒的人做梦及编织真实的梦境。编织的真实梦境令做梦者在梦中受到的伤害会体现在现实中，梦境中得到的东西也能带到现实中，反之亦然。", "attrs": {"mus": 0, "ner": 0, "int": 0, "spi": 1000, "cel": 0, "imm": 0}, "line": "custom_真实梦魇血统", "tier": 0}, "时间感悟者血统": {"name": "时间感悟者血统", "branch": "D", "price": 300, "req": null, "desc": "评价49分，适用于大部分恐怖片。技能时间感悟，对时间流逝的概念永远不会出错。", "attrs": {"mus": 0, "ner": 20, "int": 20, "spi": 30, "cel": 0, "imm": 0}, "line": "custom_时间感悟者血统", "tier": 0}, "时间停止者血统": {"name": "时间停止者血统", "branch": "C", "price": 2500, "req": "时间感悟者血统", "desc": "评价84分，适用于大部分恐怖片。技能时间停止，进入时间停止状态，安全停止时间为0.5秒，短时间内多次使用可能会进入时空乱流。", "attrs": {"mus": 0, "ner": 100, "int": 100, "spi": 200, "cel": 0, "imm": 0}, "line": "custom_时间停止者血统", "tier": 0}, "时间操纵者血统": {"name": "时间操纵者血统", "branch": "B", "price": 5000, "req": "时间停止者血统", "desc": "评价93分，适用于大部分恐怖片。技能时间操控，进入时间操控状态，能够停止时间或拨转时间，安全停止/拨转时间为1秒，短时间内多次使用可能会进入时空乱流。", "attrs": {"mus": 0, "ner": 250, "int": 250, "spi": 400, "cel": 0, "imm": 0}, "line": "custom_时间操纵者血统", "tier": 0}, "时光穿梭者血统": {"name": "时光穿梭者血统", "branch": "A", "price": 10000, "req": "时间操纵者血统", "desc": "评价97分，适用于大部分恐怖片。技能时间穿梭，进入时间穿梭状态，能够携带他人一起停止/拨转时间，安全停止/拨转时间为3秒，短时间内多次使用可能会进入时空乱流。", "attrs": {"mus": 0, "ner": 500, "int": 500, "spi": 700, "cel": 0, "imm": 0}, "line": "custom_时光穿梭者血统", "tier": 0}, "时光之主血统": {"name": "时光之主血统", "branch": "S", "price": 30000, "req": "时光穿梭者血统", "desc": "评价99分，适用于大部分恐怖片。技能时光隧道，能够开启时光隧道。", "attrs": {"mus": 0, "ner": 1500, "int": 1500, "spi": 2000, "cel": 0, "imm": 0}, "line": "custom_时光之主血统", "tier": 0}, "黑暗同行者血统": {"name": "黑暗同行者血统", "branch": "D", "price": 400, "req": null, "desc": "评价64分，适用于大部分恐怖片。技能黑暗亲和，对黑暗有很高亲和力且容易吸引黑暗生物。", "attrs": {"mus": 20, "ner": 20, "int": 20, "spi": 20, "cel": 10, "imm": 10}, "line": "custom_黑暗同行者血统", "tier": 0}, "死神血统": {"name": "死神血统", "branch": "S", "price": 30000, "req": "死神代行者", "desc": "评价95分，适用于大部分恐怖片。技能死神，难以被杀死且可以直接收割性命。", "attrs": {"mus": 500, "ner": 500, "int": 500, "spi": 500, "cel": 3000, "imm": 3000}, "line": "custom_死神血统", "tier": 0}, "初级宣判者血统": {"name": "初级宣判者血统", "branch": "D", "price": 300, "req": null, "desc": "评价64分，适用于需要延时效果的恐怖片。技能10分钟宣判，指定一个生物，10分钟后为其附加一种效果（需要兑换）。宣判生效后才能进行下次宣判。", "attrs": {"mus": 0, "ner": 30, "int": 20, "spi": 10, "cel": 0, "imm": 0}, "line": "custom_初级宣判者血统", "tier": 1}, "中级宣判者血统": {"name": "中级宣判者血统", "branch": "2D", "price": 600, "req": "初级宣判者血统", "desc": "评价70分，适用于需要延时效果的恐怖片。技能10分钟宣判和3分钟宣判。", "attrs": {"mus": 0, "ner": 60, "int": 40, "spi": 20, "cel": 0, "imm": 0}, "line": "custom_中级宣判者血统", "tier": 2}, "高级宣判者血统": {"name": "高级宣判者血统", "branch": "C", "price": 900, "req": "中级宣判者血统", "desc": "评价76分，适用于需要延时效果的恐怖片。技能10分钟宣判、3分钟宣判和30秒宣判。", "attrs": {"mus": 0, "ner": 90, "int": 60, "spi": 30, "cel": 0, "imm": 0}, "line": "custom_高级宣判者血统", "tier": 3}, "特级宣判者血统": {"name": "特级宣判者血统", "branch": "2C", "price": 1200, "req": "高级宣判者血统", "desc": "评价81分，适用于需要延时效果的恐怖片。技能10分钟宣判、3分钟宣判、30秒宣判和5秒宣判。", "attrs": {"mus": 0, "ner": 120, "int": 80, "spi": 40, "cel": 0, "imm": 0}, "line": "custom_特级宣判者血统", "tier": 4}, "极速宣判者血统": {"name": "极速宣判者血统", "branch": "B", "price": 1500, "req": "特级宣判者血统", "desc": "评价87分，适用于需要延时效果的恐怖片。技能10分钟宣判、3分钟宣判、30秒宣判、5秒宣判和2秒宣判。", "attrs": {"mus": 0, "ner": 150, "int": 100, "spi": 50, "cel": 0, "imm": 0}, "line": "custom_极速宣判者血统", "tier": 0}, "三重宣判者血统": {"name": "三重宣判者血统", "branch": "2B", "price": 3000, "req": "极速宣判者血统", "desc": "评价93分，适用于需要延时效果的恐怖片。技能10分钟宣判、3分钟宣判、30秒宣判、5秒宣判、2秒宣判和三重宣判。可以同时进行三次宣判。", "attrs": {"mus": 0, "ner": 300, "int": 200, "spi": 60, "cel": 0, "imm": 0}, "line": "custom_三重宣判者血统", "tier": 0}, "末日预言者血统": {"name": "末日预言者血统", "branch": "2B", "price": 3000, "req": "极速宣判者血统", "desc": "评价92分，适用于需要延时效果的恐怖片。技能10分钟宣判、3分钟宣判、30秒宣判、5秒宣判和2秒宣判。可以令世界末日在72小时后降临。", "attrs": {"mus": 0, "ner": 180, "int": 120, "spi": 60, "cel": 0, "imm": 0}, "line": "custom_末日预言者血统", "tier": 0}, "恶魔封印者血统": {"name": "恶魔封印者血统", "branch": "D", "price": 500, "req": null, "desc": "评价66分，适用于大部分恐怖片，将恶魔封印在自己体内的不祥之人。技能封印解除，可以依次解开体内封印并获得强大的身体素质加成，解开封印越多、时间越长、风险就越大。（封印需要兑换）", "attrs": {"mus": 20, "ner": 20, "int": 20, "spi": 20, "cel": 20, "imm": 20}, "line": "custom_恶魔封印者血统", "tier": 0}, "部落勇士血统": {"name": "部落勇士血统", "branch": "D", "price": 1000, "req": null, "desc": "评价76分，适用于大部分恐怖片。通过纹身获得强化并亲近动物，可以指定纹身部位。", "attrs": {"mus": 50, "ner": 30, "int": 10, "spi": 20, "cel": 30, "imm": 20}, "line": "custom_部落勇士血统", "tier": 0}, "部落巫师血统": {"name": "部落巫师血统", "branch": "C", "price": 1500, "req": "部落勇士血统", "desc": "评价83分，适用于大部分恐怖片。技能变形，可以与纹身产生共鸣变为所纹动物。", "attrs": {"mus": 0, "ner": 0, "int": 100, "spi": 150, "cel": 50, "imm": 50}, "line": "custom_部落巫师血统", "tier": 0}, "部落德鲁伊血统": {"name": "部落德鲁伊血统", "branch": "C", "price": 2000, "req": "部落勇士血统", "desc": "评价85分，适用于大部分恐怖片。技能纹身召唤，将纹身暂时转化为动物。", "attrs": {"mus": 0, "ner": 0, "int": 150, "spi": 100, "cel": 50, "imm": 50}, "line": "custom_部落德鲁伊血统", "tier": 0}, "黑光病毒原型体血统": {"name": "黑光病毒原型体血统", "branch": "B", "price": 12000, "req": null, "desc": "评价96分，适用于大部分恐怖片，技能吸收进化，通过吸收生物进化。", "attrs": {"mus": 50, "ner": 50, "int": 50, "spi": 50, "cel": 50, "imm": 1000}, "line": "custom_黑光病毒原型体血统", "tier": 0}, "黑光病毒变异血统": {"name": "黑光病毒变异血统", "branch": "C", "price": 4000, "req": null, "desc": "评价82分，适用于大部分恐怖片。因为是变异血统，所以不用担心被病毒控制，也没有吸收和进化功能。", "attrs": {"mus": 100, "ner": 80, "int": 50, "spi": 50, "cel": 120, "imm": 200}, "line": "custom_黑光病毒变异血统", "tier": 0}, "基因改造血统": {"name": "基因改造血统", "branch": "D", "price": 700, "req": null, "desc": "评价75分，适用于大部分恐怖片。优化了基因以适应基因改造的人类，在血统融合时有更高成功率。基因改造会造成不同程度的神经衰弱，新基因改造会覆盖同一部位的旧基因改造。", "attrs": {"mus": 50, "ner": 30, "int": 20, "spi": 0, "cel": 40, "imm": 60}, "line": "custom_基因改造血统", "tier": 0}, "基因突变": {"name": "基因突变", "branch": "C", "price": 2000, "req": "基因改造血统", "desc": "进行基因突变，也会导致现有基因改造出现变化，结果无法预测。", "attrs": {"mus": 0, "ner": 0, "int": 0, "spi": 0, "cel": 0, "imm": 0}, "line": "custom_基因突变", "tier": 0}, "眼睛-鹰基因": {"name": "眼睛-鹰基因", "branch": "D", "price": 500, "req": "基因改造血统", "desc": "与鹰的基因融合，提高静态视力，能够更清晰的看见更远的物体。", "attrs": {"mus": 0, "ner": 0, "int": 0, "spi": -20, "cel": 0, "imm": 0}, "line": "custom_眼睛_鹰基因", "tier": 0}, "鼻子-狗基因": {"name": "鼻子-狗基因", "branch": "D", "price": 300, "req": "基因改造血统", "desc": "与狗的基因融合，提高嗅觉。", "attrs": {"mus": 0, "ner": 0, "int": 0, "spi": -20, "cel": 0, "imm": 0}, "line": "custom_鼻子_狗基因", "tier": 0}, "躯干-蝾螈基因": {"name": "躯干-蝾螈基因", "branch": "C", "price": 3000, "req": "基因改造血统", "desc": "与蝾螈的基因融合，只要心脏或大脑不被破坏生命就能不停复原。", "attrs": {"mus": 0, "ner": 0, "int": 0, "spi": -30, "cel": 200, "imm": 0}, "line": "custom_躯干_蝾螈基因", "tier": 0}, "手臂-皮皮虾基因": {"name": "手臂-皮皮虾基因", "branch": "C", "price": 2000, "req": "基因改造血统", "desc": "与皮皮虾的基因融合，大幅度提高出拳速度。", "attrs": {"mus": 0, "ner": 0, "int": 0, "spi": -30, "cel": 0, "imm": 0}, "line": "custom_手臂_皮皮虾基因", "tier": 0}, "手臂-切叶蚁基因": {"name": "手臂-切叶蚁基因", "branch": "C", "price": 2000, "req": "基因改造血统", "desc": "与切叶蚁的基因融合，大幅度提高肌肉组织强度。", "attrs": {"mus": 500, "ner": 0, "int": 0, "spi": -30, "cel": 0, "imm": 0}, "line": "custom_手臂_切叶蚁基因", "tier": 0}, "腿部-猎豹基因": {"name": "腿部-猎豹基因", "branch": "D", "price": 300, "req": "基因改造血统", "desc": "与猎豹的基因融合，可以在短时间内急速冲刺。", "attrs": {"mus": 0, "ner": 0, "int": 0, "spi": -20, "cel": 0, "imm": 0}, "line": "custom_腿部_猎豹基因", "tier": 0}, "预备红色铁锤血统": {"name": "预备红色铁锤血统", "branch": "D", "price": 700, "req": null, "desc": "评价69分，适用于非科幻类恐怖片。技能预备红色铁锤，克制超自然能力。", "attrs": {"mus": 30, "ner": 20, "int": 0, "spi": 50, "cel": 20, "imm": 20}, "line": "custom_预备红色铁锤血统", "tier": 0}, "低级红色铁锤血统": {"name": "低级红色铁锤血统", "branch": "C", "price": 1500, "req": "预备红色铁锤血统", "desc": "评价75分，适用于非科幻类恐怖片。技能低级红色铁锤，克制超自然能力。", "attrs": {"mus": 80, "ner": 40, "int": 0, "spi": 100, "cel": 40, "imm": 40}, "line": "custom_低级红色铁锤血统", "tier": 0}, "中级红色铁锤血统": {"name": "中级红色铁锤血统", "branch": "B", "price": 3000, "req": "低级红色铁锤血统", "desc": "评价83分，适用于非科幻类恐怖片。技能中级红色铁锤和打倒牛鬼蛇神，削弱环境中的超自然能力。", "attrs": {"mus": 150, "ner": 80, "int": 0, "spi": 200, "cel": 80, "imm": 80}, "line": "custom_中级红色铁锤血统", "tier": 2}, "高级红色铁锤血统": {"name": "高级红色铁锤血统", "branch": "A", "price": 5500, "req": "中级红色铁锤血统", "desc": "评价89分，适用于非科幻类恐怖片。技能高级红色铁锤和打倒牛鬼蛇神，削弱环境中的超自然能力。", "attrs": {"mus": 300, "ner": 150, "int": 0, "spi": 400, "cel": 150, "imm": 150}, "line": "custom_高级红色铁锤血统", "tier": 3}, "红色监督者血统": {"name": "红色监督者血统", "branch": "S", "price": 10000, "req": "高级红色铁锤血统", "desc": "评价96分，适用于非科幻类恐怖片。技能红色监督，克制一切超自然能力。", "attrs": {"mus": 450, "ner": 250, "int": 0, "spi": 600, "cel": 250, "imm": 250}, "line": "custom_红色监督者血统", "tier": 0}, "契约师血统": {"name": "契约师血统", "branch": "D", "price": 500, "req": null, "desc": "评价70分，适用于大部分恐怖片。与他人签订契约并召唤他们。", "attrs": {"mus": 10, "ner": 20, "int": 20, "spi": 30, "cel": 10, "imm": 10}, "line": "custom_契约师血统", "tier": 0}, "低级异界召唤师血统": {"name": "低级异界召唤师血统", "branch": "D", "price": 300, "req": null, "desc": "评价73分，适用于大部分恐怖片。技能低级异界召唤，将物品作为报酬从异界吸引并契约异生物帮助你做指定的事，最高能召唤弱小的异生物。同一时间只能存在一只召唤生物。", "attrs": {"mus": 10, "ner": 10, "int": 20, "spi": 20, "cel": 10, "imm": 10}, "line": "custom_低级异界召唤师血统", "tier": 0}, "中级异界召唤师血统": {"name": "中级异界召唤师血统", "branch": "C", "price": 800, "req": "低级异界召唤师血统", "desc": "评价79分，适用于大部分恐怖片。技能中级异界召唤，将物品作为报酬从异界吸引并契约异生物帮助你做指定的事，最高能召唤实力一般的异生物。同一时间只能存在两只召唤生物。", "attrs": {"mus": 30, "ner": 30, "int": 60, "spi": 60, "cel": 30, "imm": 30}, "line": "custom_中级异界召唤师血统", "tier": 2}, "高级异界召唤师血统": {"name": "高级异界召唤师血统", "branch": "B", "price": 2000, "req": "中级异界召唤师血统", "desc": "评价86分，适用于大部分恐怖片。技能高级异界召唤，将物品作为报酬从异界吸引并契约异生物帮助你做指定的事，最高能召唤接近传奇的异生物。同一时间只能存在四只召唤生物。", "attrs": {"mus": 100, "ner": 100, "int": 200, "spi": 200, "cel": 100, "imm": 100}, "line": "custom_高级异界召唤师血统", "tier": 3}, "异界召唤大师血统": {"name": "异界召唤大师血统", "branch": "A", "price": 5000, "req": "高级异界召唤师血统", "desc": "评价92分，适用于大部分恐怖片。技能高级异界召唤，将物品作为报酬从异界吸引并契约异生物帮助你做指定的事，最高能召唤至少为传奇的异生物。同一时间只能存在十只召唤生物。", "attrs": {"mus": 300, "ner": 300, "int": 600, "spi": 600, "cel": 300, "imm": 300}, "line": "custom_异界召唤大师血统", "tier": 0}, "炉石之心血统": {"name": "炉石之心血统", "branch": "D", "price": 3000, "req": null, "desc": "评价78分，适用于需要持续战斗的恐怖片，通过在战斗中获得法力水晶来使用卡牌，初始赠送所有职业和中立的基础卡牌。（玩法与炉石传说相似，同样需要组建套牌，详情请兑换后咨询主神）", "attrs": {"mus": 0, "ner": 0, "int": 200, "spi": 200, "cel": 0, "imm": 0}, "line": "custom_炉石之心血统", "tier": 0}, "初级跑酷大师血统": {"name": "初级跑酷大师血统", "branch": "D", "price": 800, "req": null, "desc": "评价55分，适用于地形复杂且需要持续奔跑的恐怖片。提高跑酷能力。", "attrs": {"mus": 20, "ner": 50, "int": 0, "spi": 0, "cel": 20, "imm": 30}, "line": "custom_初级跑酷大师血统", "tier": 1}, "中级跑酷大师血统": {"name": "中级跑酷大师血统", "branch": "C", "price": 1500, "req": "初级跑酷大师血统", "desc": "评价65分，适用于地形复杂且需要持续奔跑的恐怖片。技能初级专注护盾，在高速跑酷时可以积累专注护盾且躲闪攻击。跑酷不够流畅或受到伤害时专注护盾会流失。", "attrs": {"mus": 50, "ner": 100, "int": 0, "spi": 0, "cel": 50, "imm": 70}, "line": "custom_中级跑酷大师血统", "tier": 2}, "高级跑酷大师血统": {"name": "高级跑酷大师血统", "branch": "B", "price": 3500, "req": "中级跑酷大师血统", "desc": "评价71分，适用于地形复杂且需要持续奔跑的恐怖片。技能中级专注护盾，在高速跑酷时可以积累专注护盾且躲闪攻击。跑酷不够流畅或受到伤害时专注护盾会流失。", "attrs": {"mus": 100, "ner": 200, "int": 0, "spi": 0, "cel": 100, "imm": 150}, "line": "custom_高级跑酷大师血统", "tier": 3}, "顶级跑酷大师血统": {"name": "顶级跑酷大师血统", "branch": "A", "price": 6000, "req": "高级跑酷大师血统", "desc": "评价80分，适用于地形复杂且需要持续奔跑的恐怖片。技能高级专注护盾，在高速跑酷时可以积累专注护盾且躲闪攻击。跑酷不够流畅或受到伤害时专注护盾会流失。", "attrs": {"mus": 200, "ner": 400, "int": 0, "spi": 0, "cel": 200, "imm": 300}, "line": "custom_顶级跑酷大师血统", "tier": 0}, "初级赌徒血统": {"name": "初级赌徒血统", "branch": "D", "price": 800, "req": null, "desc": "评价71分，适用与大部分恐怖片。技能初级赌术，同时投掷两个魔法骰子来释放赌术。", "attrs": {"mus": 10, "ner": 30, "int": 30, "spi": 20, "cel": 10, "imm": 10}, "line": "custom_初级赌徒血统", "tier": 1}, "中级赌徒血统": {"name": "中级赌徒血统", "branch": "C", "price": 1800, "req": "初级赌徒血统", "desc": "评价78分，适用与大部分恐怖片。技能中级赌术，同时投掷两个魔法骰子来释放赌术。", "attrs": {"mus": 20, "ner": 50, "int": 50, "spi": 50, "cel": 20, "imm": 20}, "line": "custom_中级赌徒血统", "tier": 2}, "高级赌徒血统": {"name": "高级赌徒血统", "branch": "B", "price": 3800, "req": "中级赌徒血统", "desc": "评价88分，适用与大部分恐怖片。技能高级赌术，同时投掷两个魔法骰子来释放赌术。", "attrs": {"mus": 50, "ner": 100, "int": 100, "spi": 100, "cel": 50, "imm": 50}, "line": "custom_高级赌徒血统", "tier": 3}, "修行天赋检查": {"name": "修行天赋检查", "branch": null, "price": 100, "req": null, "desc": "立即检查你的各项修行天赋。修行与大部分血统难以共存。（道修、鬼修、佛修、魔修、妖修）", "attrs": {}, "line": "custom_修行天赋检查", "tier": 0}, "初级血统融合": {"name": "初级血统融合", "branch": "C", "price": 3000, "req": null, "desc": "适用于需要多种血统或能量循环体系的情况，能够让你融合两个血统或同时拥有两种能量循环体系而不冲突。", "attrs": {}, "line": "custom_初级血统融合", "tier": 1}, "中级血统融合": {"name": "中级血统融合", "branch": "B", "price": 7000, "req": "初级血统融合", "desc": "能够让你融合三个血统或同时拥有三种能量循环体系而不冲突。", "attrs": {}, "line": "custom_中级血统融合", "tier": 2}, "高级血统融合": {"name": "高级血统融合", "branch": "A", "price": 12000, "req": "中级血统融合", "desc": "能够让你融合四个血统或同时拥有四种能量循环体系而不冲突。", "attrs": {}, "line": "custom_高级血统融合", "tier": 3}, "基础血统模板": {"name": "基础血统模板", "branch": null, "price": 1, "req": null, "desc": "“详见模板类。”", "attrs": {}, "line": "custom_基础血统模板", "tier": 0}, "英雄模板": {"name": "英雄模板", "branch": "D", "price": null, "req": null, "desc": "开启埃拉西亚大陆的施法/统御者体系所需前置，对自身无强化", "attrs": {}, "line": "custom_英雄模板", "tier": 0}};

  WK.Blood = {
    ensure(p){
      p = p || WK.P;
      if (!p.bloodlines || !Array.isArray(p.bloodlines.slots)) {
        p.bloodlines = { slots: [], lines: {} };
        // 兼容旧单字段
        if (p.bloodline && p.bloodline.id) {
          p.bloodlines.slots.push(p.bloodline);
          if (p.bloodline.line) p.bloodlines.lines[p.bloodline.line] = p.bloodline.id;
        }
      }
      return p.bloodlines;
    },

    findByName(name){
      return WK.BLOOD_DB[name] || null;
    },

    findCatById(id){
      if (!WK.CATALOG) return null;
      for (const ck of ["aux","tech","magic","fun"]) {
        const list = WK.CATALOG[ck] || [];
        for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      }
      return null;
    },

    isBloodlineItem(cat){
      if (!cat) return false;
      const n = cat.name || "";
      // 血族法术不是血统本体
      if (this.isBloodSkill(cat)) return false;
      if (cat.kind === "bloodline_like" || cat.kind_item === "bloodline_like") return true;
      return /血统|基因变异|强化基因|进化模式|门徒模板|神阙|罗睺|血族|狼人/.test(n) && !/法术|血魔法/.test(n);
    },
    isBloodSkill(cat){
      if (!cat) return false;
      const n = cat.name || "";
      return /^血族法术/.test(n) || /^血魔法-/.test(n) || (cat.kind_item === "skill" && /血族|鲜血|红炎/.test(n));
    },
    /* 血族能量上限（按阶） */
    /* ========== v161 血统系配置 ========== */
    LINE_DEFS: {
      vampire: {
        label: "血族", energy: "blood",
        energyName: "血族能量",
        traits: ["regen_vampire", "lifesteal", "no_sun_fear"],
        tierCaps: { "男爵":80, "子爵":120, "伯爵":180, "侯爵":280, "亲王":400, "帝王":600, _default:80 }
      },
      werewolf: {
        label: "狼人", energy: "rage",
        energyName: "狂化能量",
        traits: ["night_boost"],
        tierCaps: { "初级":70, "中级":120, "高级":200, _default:70 },
        grantSkills: { "高级": ["wolf_claw"] }
      },
      tvirus: {
        label: "T病毒", energy: "virus",
        energyName: "病毒活性",
        traits: ["virus_adapt"],
        tierCaps: { _default:100 },
        grantSkills: { _all: ["virus_burst"] }
      },
      spiderman: {
        label: "蜘蛛侠", energy: null,
        traits: ["wall_crawl"],
        grantSkills: { _all: ["spider_web"] }
      },
      ripper: {
        label: "开膛手", energy: "spirit",
        energyName: "雾都精神",
        traits: ["fog_affinity"],
        tierCaps: { _default:90 },
        grantSkills: { _all: ["fog_london"] }
      },
      clueweb: {
        label: "线索之网", energy: "spirit",
        energyName: "推理精神",
        traits: ["detective"],
        tierCaps: { _default:80 },
        grantSkills: { _all: ["clue_net"] }
      },
      troll: {
        label: "巨魔", energy: null,
        traits: ["regen_troll"],
        grantSkills: { _all: ["troll_regrow"] }
      },
      plant: {
        label: "植物", energy: "nature",
        energyName: "自然能量",
        traits: ["photo_synth"],
        tierCaps: { _default:60 },
        grantSkills: { _all: ["photo_synth"] }
      },
      flower: {
        label: "花妖", energy: "nature",
        energyName: "自然能量",
        traits: ["photo_synth", "pollen"],
        tierCaps: { "初级":90, "中级":140, "高级":220, _default:90 }
      },
      shining: {
        label: "闪灵", energy: "spirit",
        energyName: "闪灵精神",
        traits: ["psychic"],
        tierCaps: { "初级":80, "中级":130, "高级":200, "特级":300, "最终":450, _default:80 },
        grantSkills: { "中级": ["shine_pulse"], "高级": ["shine_pulse"], "特级": ["shine_pulse"], "最终": ["shine_pulse"] }
      },
      magicbullet: {
        label: "魔弹射手", energy: "spirit",
        energyName: "魔弹魔力",
        traits: ["sharpshoot"],
        tierCaps: { "初级":90, "中级":150, "高级":240, _default:90 },
        grantSkills: { "中级": ["magic_shot"], "高级": ["magic_shot"] }
      },
      disciple: {
        label: "门徒", energy: "spirit",
        energyName: "信仰精神",
        traits: ["faith"],
        tierCaps: { "低阶":70, "中阶":120, "高阶":200, _default:70 }
      },
      shenque: {
        label: "神阙", energy: "ling",
        energyName: "灵力",
        traits: ["ling_cycle"],
        tierCaps: { "初级":80, "中级":140, "高级":220, _default:80 },
        grantSkills: { "中级": ["ling_bolt"], "高级": ["ling_bolt"] }
      },
      luohou: {
        label: "罗睺", energy: "erosion",
        energyName: "蚀之力",
        traits: ["erosion"],
        tierCaps: { "初级":100, "高级":180, "使者":280, _default:100 },
        grantSkills: { "高级": ["erosion_touch"], "使者": ["erosion_touch"] }
      },
      brain: {
        label: "脑魔", energy: "spirit",
        energyName: "脑域精神",
        traits: ["psychic"],
        tierCaps: { "初级":90, "中级":150, "高级":230, _default:90 },
        grantSkills: { "中级": ["shine_pulse"], "高级": ["shine_pulse"] }
      },
      murloc: { label:"鱼人", energy:"nature", energyName:"潮汐能量", traits:["aquatic"], tierCaps:{_default:85} },
      elf: { label:"精灵", energy:"spirit", energyName:"精灵精神", traits:["night_boost"], tierCaps:{_default:100} },
      phantom: { label:"幻影刺客", energy:"spirit", energyName:"影杀精神", traits:["night_boost"], tierCaps:{"见习":70,"初级":90,"中级":130,"高级":180,_default:90} },
      beastmaster: { label:"驯兽师", energy:"nature", energyName:"兽契", traits:["bloodline_power"], tierCaps:{"初级":80,"中级":120,"高级":170,_default:80} },
      archer: { label:"射手", energy:"spirit", energyName:"弓术精神", traits:["sharpshoot"], tierCaps:{"见习":70,"初阶":90,"中阶":130,"高阶":180,"荒野":110,"传奇":200,_default:90} },
      gunner: { label:"枪手", energy:"spirit", energyName:"枪术精神", traits:["sharpshoot"], tierCaps:{_default:100} },
      nightborn: { label:"夜裔", energy:"blood", energyName:"夜裔能量", traits:["night_boost"], tierCaps:{_default:100} },
      demon: { label:"恶魔", energy:"erosion", energyName:"魔能", traits:["erosion"], tierCaps:{_default:120} },
      angel: { label:"天使", energy:"ling", energyName:"圣力", traits:["faith"], tierCaps:{_default:120} },
      elemental: { label:"元素法师", energy:"mana", energyName:"法力", traits:["psychic"], tierCaps:{ "学徒":70,"专家":120,"大师":180,"宗师":260,_default:110} },
      dragon: { label:"龙裔", energy:"rage", energyName:"龙威", traits:["regen_strong"], tierCaps:{_default:140} }
      // 豆包v178：虚拟偶像（DIY 口述系）已随 REMOVED_BLOODS 下架，LINE_DEFS 同步移除，杜绝任何再生成路径
    },

    detectLine(name){
      const n = name || "";
      if (/血族/.test(n) && !/法术|血魔法/.test(n)) return "vampire";
      if (/狼人/.test(n)) return "werewolf";
      if (/T病毒/.test(n)) return "tvirus";
      if (/蜘蛛侠/.test(n)) return "spiderman";
      if (/开膛手/.test(n)) return "ripper";
      if (/线索之网/.test(n)) return "clueweb";
      if (/巨魔/.test(n)) return "troll";
      if (/花妖/.test(n)) return "flower";
      if (/植物变异/.test(n)) return "plant";
      if (/闪灵/.test(n)) return "shining";
      if (/魔弹/.test(n)) return "magicbullet";
      if (/门徒|圣子/.test(n)) return "disciple";
      if (/神阙/.test(n)) return "shenque";
      if (/罗睺/.test(n)) return "luohou";
      if (/脑魔/.test(n)) return "brain";
      if (/鱼人/.test(n)) return "murloc";
      if (/精灵/.test(n)) return "elf";
      if (/幻影刺客/.test(n)) return "phantom";
      if (/驯兽/.test(n)) return "beastmaster";
      if (/猎人|弓箭|射手|弓斗/.test(n)) return "archer";
      if (/枪手|高斯|脉冲枪|魔枪/.test(n)) return "gunner";
      if (/夜之子|娜迦|魅魔/.test(n)) return "nightborn";
      if (/恶魔|魔族/.test(n)) return "demon";
      if (/天使/.test(n)) return "angel";
      if (/元素|火焰|冰霜|雷电|风系/.test(n)) return "elemental";
      if (/龙/.test(n)) return "dragon";
      // 豆包v178：虚拟偶像映射已移除（DIY 口述系，见 REMOVED_BLOODS）
      let core = n.replace(/(初级|中级|高级|特级|最终|见习|初阶|中阶|高阶|低阶|传奇|荒野)/g, "");
      core = core.replace(/(变异血统|强化基因|进化模式|血统|基因|模板)/g, "");
      core = core.replace(/\s+/g, "").slice(0, 12) || "misc";
      return "g_" + core;
    },
    branchScale(branch){
      if (!branch) return 1.0;
      const s = String(branch).toUpperCase().replace(/\s/g, "");
      if (/S/.test(s) && !/SS/.test(s)) return 1.35;
      if (/AA|双A|2A/.test(s)) return 1.28;
      if (/A/.test(s)) return 1.22;
      if (/BB|双B|2B/.test(s)) return 1.15;
      if (/B/.test(s)) return 1.10;
      if (/CC|双C|2C/.test(s)) return 1.06;
      if (/C/.test(s)) return 1.03;
      return 1.0;
    },
    priceScale(price){
      const p = Number(price) || 0;
      return 1 + Math.min(0.08, (p / 5000) * 0.02);
    },
    skillLineScale(skill){
      const p = WK.P;
      if (!p || !skill) return 1;
      const bl = this.ensure(p);
      let best = 1;
      bl.slots.forEach(s => {
        const sc = this.branchScale(s.branch) * this.priceScale(s.price);
        if (sc > best) best = sc;
      });
      return best;
    },


    detectTierKey(name){
      const n = name || "";
      const keys = ["最终","宗师","特级","大师","帝王","亲王","侯爵","专家","伯爵","子爵","男爵","使者","学徒","高阶","中阶","低阶","高级","中级","初级"];
      for (let i = 0; i < keys.length; i++) if (n.indexOf(keys[i]) >= 0) return keys[i];
      return null;
    },

    energyCapFor(slot){
      const name = (slot && slot.name) || "";
      const line = (slot && slot.line) || this.detectLine(name);
      const def = this.LINE_DEFS[line];
      if (!def || !def.energy) return 0;
      const tk = this.detectTierKey(name);
      if (tk && def.tierCaps && def.tierCaps[tk] != null) return def.tierCaps[tk];
      return (def.tierCaps && def.tierCaps._default) || 80;
    },

    applyLineProfile(slot){
      const line = slot.line || this.detectLine(slot.name);
      slot.line = line;
      const def = this.LINE_DEFS[line];
      // 六维：表内未写或为 0 则不加
      if (slot.attrs) {
        const clean = {};
        let any = false;
        Object.keys(slot.attrs).forEach(function(k){
          const v = Number(slot.attrs[k]) || 0;
          if (v) { clean[k] = v; any = true; }
        });
        slot.attrs = any ? clean : {};
      }
      if (def) {
        slot.traits = (def.traits || []).slice();
        // 豆包v175：标准系手工 traits 之外，再按名字/描述补全机制类特质（血族不死、免疫、强韧等）
        this.guessTraits(slot.name, slot.desc).forEach(k => { if (slot.traits.indexOf(k) < 0) slot.traits.push(k); });
        if (def.energy) {
          const cap = this.energyCapFor(slot);
          slot.energy = { type: def.energy, max: cap, cur: cap, name: def.energyName || def.energy };
        }
        const grants = def.grantSkills || {};
        const tk = this.detectTierKey(slot.name);
        let toGrant = [];
        if (grants._all) toGrant = toGrant.concat(grants._all);
        if (tk && grants[tk]) toGrant = toGrant.concat(grants[tk]);
        if (tk === "高级" || tk === "特级" || tk === "最终" || tk === "使者" || tk === "高阶") {
          if (grants["中级"]) toGrant = toGrant.concat(grants["中级"]);
          if (grants["中阶"]) toGrant = toGrant.concat(grants["中阶"]);
          if (grants["高级"]) toGrant = toGrant.concat(grants["高级"]);
        }
        slot.skills = slot.skills || [];
        toGrant.forEach(sid => {
          if (slot.skills.indexOf(sid) < 0) slot.skills.push(sid);
        });
        /* 豆包v174：标准系在该档位没配 grantSkills 时（多为初阶 / 冷门系），同样用签名技引擎按 desc 补，
           保证 355 条血统兑换后都有真实可用技能；能量仍以本系 def 为准、不串系。 */
        if (!toGrant.length && this.buildGenericSigs) {
          const ET2SK = { mana:"magic", neili:"martial", energy:"mecha", stamina:"aux", blood:"blood", rage:"rage", virus:"virus", spirit:"spirit", nature:"nature", erosion:"erosion", ling:"ling" };
          const engd = def.energy
            ? { type:def.energy, name:def.energyName||def.energy, skillType:def.skillType||ET2SK[def.energy]||def.energy, powerStat:def.powerStat||"mind", physical:false }
            : this.guessEnergy(slot.name);
          this.buildGenericSigs(slot, engd).forEach(sid => {
            if (slot.skills.indexOf(sid) < 0) slot.skills.push(sid);
          });
        }
      } else {
        // 豆包v174：通用血统 —— 由签名技引擎按 desc 的原著技能生成 1~2 个真实技能。
        // 纯肉身 / 近战血统（eng.physical）不另开能量池，技能耗体力；其余按档位给能量池。
        const eng = this.guessEnergy(slot.name);
        if (eng.physical) {
          slot.energy = null;
        } else {
          const cap = this.genericEnergyCap(slot.branch, slot.price);
          slot.energy = { type: eng.type, max: cap, cur: cap, name: eng.name };
        }
        slot.traits = this.guessTraits(slot.name, slot.desc);
        slot.skills = slot.skills || [];
        this.buildGenericSigs(slot, eng).forEach(sid => {
          if (slot.skills.indexOf(sid) < 0) slot.skills.push(sid);
        });
      }
      return slot;
    },
    /* 豆包v173：重写能量归类。
       旧版首条 /血/ 把「火元素师血统」里的「血」误判成血族能量（凡名字带『血统』二字全中招）。
       现在先剥掉体系尾缀再判，并明确区分：法师/元素/萨满→mana 法力；血族→blood；射手/精神系→spirit；
       自然/德鲁伊→nature。内力(neili)不产自血统，由「气功」等修炼强化开启 WK.Blood Pools。 */
    guessEnergy(name){
      const raw = name || "";
      const n = raw.replace(/变异血统|变异|血统|血脉|基因|模板|强化|进化模式|原型体/g, "");
      if (/病毒|丧尸|尸变|T毒|黑光|感染体|病原体/.test(n)) return { type:"virus", name:"病毒活性", skillType:"virus", powerStat:"body" };
      if (/罗睺|蚀之|侵蚀|腐蚀|深渊|恶魔|魔族|魔裔|堕天|暗魇|幽垠/.test(n)) return { type:"erosion", name:"蚀之力", skillType:"erosion", powerStat:"mind" };
      if (/植物|花妖|花仙|自然|光合|德鲁伊|驯兽|兽契|鱼人|娜迦|潮汐|水生|野兽|森林/.test(n)) return { type:"nature", name:"自然能量", skillType:"nature", powerStat:"body" };
      if (/魔弹|枪手|神射|射手|弓箭|弓斗|弓术|猎人|刺客|狙击|脉冲枪|高斯枪/.test(n)) return { type:"spirit", name:"专精精神", skillType:"spirit", powerStat:"phys" };
      if (/法师|魔导|魔法师|元素师|火元素|水元素|冰元素|雷元素|风元素|地元素|奥术|萨满|术士|巫师|巫妖|施法|魔力|法力|元素|魔法/.test(n)) return { type:"mana", name:"法力", skillType:"magic", powerStat:"mind" };
      if (/血族|吸血|鲜血|猩红|血能|蝠|该隐|德库拉|德古拉|夜之子|夜裔/.test(n)) return { type:"blood", name:"血族能量", skillType:"blood", powerStat:"mind" };
      if (/狼人|狼族|狂化|狂战|龙裔|龙血|兽化|蛮荒|野蛮人|巨魔/.test(n)) return { type:"rage", name:"狂化能量", skillType:"rage", powerStat:"phys" };
      // 豆包v174：神圣信仰系 → 圣光灵力；纯火焰法术系（无『法师』字样的魔王/凤凰等）→ 火焰法力
      if (/牧师|圣骑|圣骑士|信仰|神契|信徒|审判|裁决|圣光|神圣|祭司|神官|圣言|圣职|教廷|先知教/.test(n)) return { type:"ling", name:"圣光灵力", skillType:"ling", powerStat:"mind" };
      if (/凤凰|魔王|魔神|炎魔|火神|火灵|焰灵|狱火/.test(n)) return { type:"mana", name:"火焰法力", skillType:"magic", powerStat:"mind" };
      // 豆包v174：纯肉身 / 近战 / 变形肉搏血统 → 不另开能量池，技能耗体力。
      // 旧版一律兜底成『精神力』，导致剑士/武僧/兽人/矮人/一拳/异形等物理血统能量与伤害属性全部错配。
      if (/剑士|剑客|剑豪|剑圣|剑神|剑气|风之剑|武僧|武者|武斗|兽人|矮人|一拳|雪怪|异形|食尸|石像鬼|鹰身|骑兵|骑士|斗士|战士|格斗|拳|蛮力|巨兽|泰坦|刺客|暗杀|夜行|亡魂|亡灵骑士|角斗|斯巴达|维京|尸王/.test(n))
        return { type:"stamina", name:null, physical:true, skillType:"martial", powerStat:"phys" };
      if (/精灵|偶像|闪灵|脑域|脑魔|精神|意念|念力|推理|侦探|幻影|影杀|心灵/.test(n)) return { type:"spirit", name:"精神力", skillType:"spirit", powerStat:"mind" };
      if (/神阙|圣力|天使|佛|灵力|灵氛/.test(n)) return { type:"ling", name:"灵力", skillType:"ling", powerStat:"mind" };
      return { type:"spirit", name:"血统精神", skillType:"spirit", powerStat:"mind" };
    },
    /* 豆包v175：口述/DIY 向血统无法在文字游戏里量化（需玩家自行设定 / 咨询主神 / 自己组牌），
       从血统库与兑换目录一并下架，避免买了只剩名字、战斗无技能可用。
       豆包v178：炉石系附属（卡包/卡牌）由 catalogInstall 按「炉石之心」前缀一并下架。 */
    REMOVED_BLOODS: ["虚拟偶像模板", "炉石之心血统"],

    /* 豆包v175：特质统一识别。key 分三类——
       ① 数值类（进 WK.BLOOD_TRAITS[*].stats，战斗 profile 自动聚合：atk/hit/crit/armor/maxHp/chargeSpd）；
       ② 再生类（regenAll 按档每秒回血）；
       ③ 机制类（_enemyAttack 受伤钩子 / 造伤吸血钩子真正判定：免疫、减伤、致命留血）。
       纯场景类（水生/飞行/夜视探索）本集无对应地形，先作标签、在后续有水/空域的恐怖片接入。 */
    guessTraits(name, desc){
      const s = (name||"") + (desc||"");
      const t = [];
      const add = k => { if (t.indexOf(k) < 0) t.push(k); };
      // —— 再生 / 不死 ——
      if (/血族|吸血鬼|吸血|该隐|德古?拉|猩红|蝠|夜之子|夜裔/.test(s)) { add("regen_vampire"); add("lifesteal"); }
      if (/巨魔|断肢重生|超速再生|超强再生|急速再生|肢体再生/.test(s)) add("regen_troll");
      else if (/再生|复原|愈合|恢复力/.test(s)) add("regen_strong");
      if (/光合|植物|花妖|花仙|藤蔓/.test(s)) add("photo_synth");
      // —— 免疫 / 抗性（受伤钩子判定）——
      if (/亡灵|死灵|不死生物|骷髅|亡魂|尸王|食尸鬼|石像鬼|机械|机甲|傀儡|构装/.test(s)) add("plague_immune");
      if (/毒免|毒素免疫|百毒不侵|免疫毒|剧毒无效|抗毒体质/.test(s)) add("poison_immune");
      if (/火免|火焰免疫|免疫火|烈焰不侵|不惧火焰|焚身不伤|避火/.test(s)) add("fire_immune");
      if (/寒免|冰免|免疫冰|冰封不侵|不惧严寒|抗寒体质/.test(s)) add("cold_immune");
      if (/魔法免疫|法术免疫|魔免|无效化魔法/.test(s)) add("magic_immune");
      else if (/魔法抗性|抗魔|魔抗|抵抗魔法|法术抗性/.test(s)) add("magic_resist");
      // —— 强韧躯体（物理百分比减伤 + 血甲）——
      if (/锻体|硬化皮肤|岩石之躯|石像|石肤|金属之躯|钢铁之躯|铜皮铁骨|甲壳|厚皮|鳞甲|巨人之躯|磐石/.test(s)) add("phys_hardy");
      // —— 数值向特质 ——
      if (/夜视|黑暗中作战|暗夜|夜行|夜袭|暗影|影杀/.test(s)) add("night_fighter");
      if (/精神力|精神强|脑域|念力|心灵感应/.test(s)) add("psychic");
      if (/神射|射手|枪手|精准|狙击|鹰眼/.test(s)) add("sharpshoot");
      if (/迅捷|疾风|身法|速度极快|轻盈|风之一族/.test(s)) add("swift");
      if (/水栖|水生|鱼人|娜迦|两栖/.test(s)) add("aquatic");
      if (/飞行|翅膀|翱翔|制空/.test(s)) add("flyer");
      // 再生档去重：已有血族之心/巨魔再生时，不再叠加被描述词误触发的弱档「强再生」
      if (t.indexOf("regen_vampire") >= 0 || t.indexOf("regen_troll") >= 0) {
        for (let k = t.length - 1; k >= 0; k--) if (t[k] === "regen_strong") t.splice(k, 1);
      }
      if (!t.length) add("bloodline_power");
      return t;
    },

    /* 豆包v175：聚合玩家身上【全部血统】的特质（可叠加多血统），供受伤/吸血/再生钩子统一判定 */
    allTraits(p){
      p = p || WK.P;
      const set = [];
      const push = k => { if (k && set.indexOf(k) < 0) set.push(k); };
      if (p && p.bloodline && p.bloodline.traits) p.bloodline.traits.forEach(push);
      if (WK.Blood) {
        const bl = WK.Blood.ensure(p);
        (bl.slots || []).forEach(sl => (sl.traits || []).forEach(push));
      }
      return set;
    },
    hasTrait(p, keys){
      const ts = this.allTraits(p);
      return (Array.isArray(keys) ? keys : [keys]).some(k => ts.indexOf(k) >= 0);
    },

    /* ===== 豆包v174：通用血统签名技引擎 =====
       BLOOD_DB 里 323 个 line="custom_*" 的血统，旧版一律发一个名字叫「XX·异能」、描述只有
       「伤害=基础X+能力×Y」的占位技能。但每条 desc 其实都按原著写了「技能XX，效果……」。
       本引擎：① 从 desc 解析原著技能名与效果句（支持『A和B』两个技能）；② 按关键词推断战斗形态；
       ③ 数值随支线等级 / 价格 / 档位缩放。只产出战斗系统已支持的 attack/heal/dodge/buff/passive
       五种形态，绝不发明战斗读不到的字段（避免「能点没用」的假技能）。招牌血统见 SIG_OVERRIDE。 */
    _sigHash(s){
      let h=2166136261;
      for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
      return ("0000000"+(h>>>0).toString(36)).slice(-9);
    },
    _sigTierWord(name){
      const m=String(name||"").match(/(终极|传说|传奇|宗师|剑神|之神|完全体|神秘|高阶|高级|大师|专家|中级|熟练|初级|见习|幼年|成年|壮年)/);
      if(!m) return 0;
      const w=m[1];
      if(/终极|传说|传奇|宗师|剑神|之神|完全体|神秘/.test(w)) return 4;
      if(/高阶|高级|大师|专家|壮年|成年/.test(w)) return 3;
      if(/中级|熟练/.test(w)) return 2;
      return 1;
    },
    /* 招牌血统手工精调（key=BLOOD_DB 全名）。每项给 {name 技能名, kind, tgt?, ef 原著效果句, 数值覆盖}。
       能量 / 类型 / 资源 / sid 由引擎按该血统统一补全，这里只写与名场面相关的差异。 */
    SIG_OVERRIDE: {
      "一拳超人基因": [ {name:"认真一拳",kind:"attack",tgt:"single",base:46,mult:0.20,hit:0.30,crit:0.30,critMult:2.4,ef:"认真模式下肌肉组织强度翻倍，倾注全力的一拳"} ],
      "终极一拳基因": [ {name:"五倍拳力",kind:"buff",ef:"短时间内将拳力催至五倍，命中与暴击暴涨"}, {name:"重炮拳",kind:"attack",tgt:"single",ef:"以五倍拳力正面轰出"} ],
      "高级一拳基因": [ {name:"双倍拳力",kind:"buff",ef:"短时间内将拳力翻倍"}, {name:"直拳重击",kind:"attack",tgt:"single",ef:"翻倍拳力下的一记重击"} ],
      "矮人山丘之王变异血统": [ {name:"天神下凡",kind:"buff",ef:"短暂进入天神状态，魔法免疫，防御与战斗力大幅提高"} ],
      "传奇武僧血统": [ {name:"传奇锻体",kind:"passive",defensive:true,ef:"极大幅度提高防御力与对精神攻击的抗性，金刚不坏常驻"}, {name:"金刚掌",kind:"attack",tgt:"single",ef:"武僧真气灌注的刚猛掌击"} ],
      "剑神血统": [ {name:"无上剑气",kind:"attack",tgt:"group",ef:"御剑成风，纵横剑气扫过全场"} ],
      "剑圣血统": [ {name:"独孤剑气",kind:"attack",tgt:"single",armorPen:0.4,ef:"凝于一线的致命剑气，可破重甲"} ],
      "疾风剑豪血统": [ {name:"疾风剑",kind:"attack",tgt:"single",ef:"风之能量附着兵刃，高速斩击"}, {name:"风之壁障",kind:"dodge",ef:"创造阻挡魔法与投射物的风墙"} ],
      "异形变异开发血统": [ {name:"酸蚀利爪",kind:"attack",tgt:"single",ef:"以异形战斗本能猛扑撕裂，腐蚀血液附带灼伤"}, {name:"异形之躯",kind:"passive",defensive:true,ef:"腐蚀血液、攀爬、异形视力与战斗本能常驻"} ],
      "凤凰之神变异血统": [ {name:"凤凰火焰",kind:"attack",tgt:"group",ef:"全身包裹凤凰火焰，烈焰席卷全场且免疫火焰"}, {name:"涅槃重生",kind:"heal",ef:"致命伤害时化蛋重生；主动运转涅槃之力恢复大量生命"} ],
      "成年凤凰变异血统": [ {name:"凤凰火焰",kind:"attack",tgt:"group",ef:"凤凰火焰环绕周身，焚烧整组敌人"}, {name:"涅槃重生",kind:"heal",ef:"受到致命伤害时化为凤凰蛋，运转涅槃恢复伤势"} ],
      "高级鹰眼狙击手血统": [ {name:"要害必中",kind:"attack",tgt:"single",hit:0.45,crit:0.40,ef:"看破弱点要害，发动必定攻向要害的远程一击"} ],
      "终极守望者基因": [ {name:"追猎锁定",kind:"attack",tgt:"single",ef:"令目标减速并生出恐惧，趁其慌乱精准点杀"} ],
      "暗杀者血统": [ {name:"气息遮蔽",kind:"dodge",ef:"完全隐藏杀意与实力，敌人难以捕捉你的位置"} ],
      "夜行者血统": [ {name:"夜隐",kind:"dodge",ef:"光线暗淡处完全隐身，任何行动都不破除隐身"} ],
      "食尸鬼王变异血统": [ {name:"食尸鬼爪",kind:"attack",tgt:"single",ef:"手掌化为食尸鬼爪撕裂目标"}, {name:"吞食尸骸",kind:"heal",ef:"吞食尸体恢复伤势"} ],
      "高阶石像鬼变异血统": [ {name:"石像形态",kind:"buff",defensive:true,ef:"化为石像，行动放缓但防御力与再生力大幅提高"} ],
      "大德鲁伊血统": [ {name:"自然之怒",kind:"attack",tgt:"group",ef:"施展 A 级自然法术，召唤藤棘与风暴席卷敌群"}, {name:"野兽变形",kind:"buff",ef:"变形为猛兽，短时间提升战力"} ],
      "亡灵法师变异血统": [ {name:"亡灵法术",kind:"attack",tgt:"group",ef:"驱使亡灵与寒气侵蚀整组敌人"}, {name:"亡灵之躯",kind:"passive",defensive:true,ef:"无生命与灵魂，免疫绝大部分精神法术与病毒"} ],
      "毁灭术士血统": [ {name:"毁灭之火",kind:"attack",tgt:"group",ef:"毁灭之力灌注法术，造成毁灭性范围伤害"} ],
      "神圣骑士血统": [ {name:"圣光斩",kind:"attack",tgt:"single",ef:"以信仰之力凝于剑锋斩出圣光，对亡灵邪祟尤烈"}, {name:"圣光治愈",kind:"heal",ef:"以圣光为自身抚平伤口"} ],
      "高级牧师血统": [ {name:"强效治疗术",kind:"heal",ef:"信仰加深，治疗法术效果大幅增强"} ],
      "审判者血统": [ {name:"神罚审判",kind:"attack",tgt:"single",ef:"依敌人罪恶程度降下神罚，短时间强化神契力"} ],
      "高级催眠师血统": [ {name:"精神控制",kind:"attack",tgt:"single",ef:"以精神力直接操控目标，趁其失神予以重击"} ],
      "三眼族变异血统": [ {name:"天目",kind:"attack",tgt:"single",hit:0.30,ef:"睁开额上天目，以精神念力锁定轰击"} ],
      "完全体兽人变异血统": [ {name:"兽人狂化",kind:"buff",ef:"异体化短时间极大幅度提高近战伤害"}, {name:"蛮力砸击",kind:"attack",tgt:"single",ef:"兽化后的蛮力一击"} ],
      "高级雪怪变异血统": [ {name:"雪怪形态",kind:"buff",ef:"化作雪怪，短时间大幅提高身体素质、肌肉强度与耐寒"} ]
    },
    /* 从 desc 抽出原著技能段（名 + 效果句），名段按 和/与/、 拆成至多 2 个 */
    _sigParse(desc){
      const out = { segs:[], ef:"" };
      const m = String(desc||"").match(/技能[“"]?\s*([^，。；：]+?)\s*[”"]?[，。；：]\s*([^。]{0,46})/);
      if(!m) return out;
      out.ef = (m[2]||"").trim();
      const rank=/^(初级|中级|高级|终极|终极|见习|熟练|大师|专家|传奇|宗师|高阶|完全体|幼年|成年|壮年|神秘)+/;
      out.segs = m[1].split(/和|与|、|，/).map(s=>s.trim().replace(rank,"").trim()).filter(s=>s).slice(0,2);
      return out;
    },
    _sigShortName(name){
      return String(name||"血统").replace(/(初级|中级|高级|终极|见习|熟练|大师|专家|传奇|宗师|高阶)/g,"").replace(/变异血统|变异|血统|血脉|基因|模板|强化/g,"").trim() || "血统";
    },
    /* 无技能名时按血统主题兜底一个主动技 */
    _sigFallback(slot, eng){
      const n=slot.name||"";
      if(/一拳|拳/.test(n)) return {name:"普通拳",kind:"attack",tgt:"single",ef:"朴素却蕴含巨力的直拳"};
      if(/异形/.test(n)) return {name:"异形撕袭",kind:"attack",tgt:"single",ef:"以异形本能扑咬撕裂"};
      if(/三眼|天眼/.test(n)) return {name:"天目",kind:"attack",tgt:"single",hit:0.28,ef:"额上天目射出精神念力"};
      if(/牧师|祭司/.test(n)) return {name:"圣光愈",kind:"heal",ef:"以圣光恢复伤势"};
      if(/圣骑|骑士|骑兵/.test(n)) return {name:"骑乘冲锋",kind:"buff",ef:"催动骑乘发起冲锋，短时间提升战力"};
      if(/鹰眼|狙击|射手|守望|猎人/.test(n)) return {name:"精准射击",kind:"attack",tgt:"single",hit:0.2,crit:0.18,ef:"瞄准弱点的精准一击"};
      if(/术士|法师|巫/.test(n)) return {name:"秘术冲击",kind:"attack",tgt:"single",ef:"凝聚超自然能量轰击目标"};
      return {name:this._sigAtkName(slot,eng),kind:"attack",tgt:"single",ef:"激发血统之力发动一击"};
    },
    /* 依据技能名 / 效果句 / 血统名推断战斗形态。以「技能名」为主、效果句为辅：
       像「凤凰火焰」效果句虽提到『免疫火焰』，技能本身仍是群攻，不能被『免疫』带偏成被动。 */
    _sigInfer(seg, ef, slot){
      const s=String(seg||""), t=s+" "+String(ef||"");
      const H=re=>re.test(t);
      // 豆包v176：生物召唤——技能名 / 效果 / 血统名含「召唤师·召唤者」或明确召唤某种生物援军 → summon 形态
      // （必须在含裸「召唤」的群攻判定之前；「召唤风暴/火雨/藤棘」无生物词，不会误命中）
      const full=t+" "+(slot?(slot.name+" "+(slot.desc||"")):"");
      if(/召唤师|召唤者/.test(full) ||
         /真名召唤|契约召唤|异界召唤|组合召唤|亡灵召唤|召唤术/.test(full) ||
         /召唤.{0,8}(异生物|异界生物|生物|召唤兽|骷髅|亡灵|亡者|尸鬼|狼|狼魂|犬|地狱犬|巨兽|猛兽|仆从|使徒|元素生物|元素|石像鬼|尸体|尸傀|蜘蛛|毒蛇|飞鹰|雄狮|幼龙|凤凰|天使|恶魔|怪物|援军|造物|分身)/.test(full))
        return {kind:"summon"};
      const ATK_ANY=/剑(气|斩|豪)?|爪|突刺|刺杀|刺击|穿刺|骨刺|毒刺|弹|冲击|重击|猛击|扑击|连击|打击|拳|审判|裁决|天眼|火焰|烈焰|圣光|邪能|诅咒|催眠|追猎|魔弹|蚀|吞噬|吸收|雷|焰|轰|碎|撕|噬|死光|凝视|射线|寒击/;
      if(H(/隐身|隐形|遮蔽|模糊|幽灵步|潜行|壁障|气息/)) return {kind:"dodge"};
      if(H(/恢复|回复|愈合|治疗|治愈|再生|重生|涅槃|吞食|食尸|水之呼唤|救赎|圣光愈|汲取生命/)) return {kind:"heal"};
      if(H(/凤凰火焰|召唤|驯兽|纹身|鱼人|风暴|暴雨|火雨|怒焰|吐息|喷[吐洒]|横扫|践踏|乱舞|齐射|藤棘|席卷|领域/)) return {kind:"attack",tgt:"group"};
      if(H(/变身|变形|形态|模式|狂化|狂暴|附体|之潮|冲锋|飞行|降临|觉醒|开光|爆发|威能|神威|改造|强化|短时间|短暂|暂时/)) return {kind:"buff", defensive:H(/防御|魔免|魔抗|硬化|石像/)};
      if(H(ATK_ANY)) return {kind:"attack", tgt:"single", armorPen:H(/破甲|穿透/) ? 0.35 : 0};
      if(H(/锻体|皮肤|之躯|免疫|抗性|抵抗|亲和|本能|契约|精通|习性|视野|视力|看破|锻造|附魔|骑乘|学习.*法术|体质|硬化|天赋|躯壳|无畏|适应|循环/) && !H(/短时间|短暂|暂时/))
        return {kind:"passive", defensive:H(/免疫|抗性|抵抗|皮肤|锻体|之躯|硬化|魔抗/)};
      if(H(/提高|提升|增强|加速/)) return {kind:"buff", defensive:H(/防御|魔免|魔抗|硬化/)};
      return {kind:"attack", tgt:"single"};
    },
    /* 补位主动技的正经命名（按血统体系），消灭旧版「XX·异能」懒占位 */
    _sigAtkName(slot, eng){
      const n=String(slot.name||"");
      if(eng && eng.physical){
        if(/武僧|罗汉/.test(n)) return "伏魔拳";
        if(/剑/.test(n)) return "剑气斩";
        if(/兽人|狂|蛮|雪怪|泰坦|巨人/.test(n)) return "蛮力砸击";
        if(/异形/.test(n)) return "利爪突袭";
        if(/食尸|亡灵|亡魂|石像/.test(n)) return "亡灵爪击";
        if(/骑/.test(n)) return "骑枪突刺";
        if(/鹰身|飞行/.test(n)) return "俯冲掠击";
        if(/矮人/.test(n)) return "重锤轰击";
        if(/拳/.test(n)) return "重拳";
        return "斗气一击";
      }
      const ty=eng&&eng.type;
      if(ty==="mana"){ if(/凤|火/.test(n)) return "烈焰冲击"; if(/亡灵|死灵/.test(n)) return "死灵寒击"; if(/术/.test(n)) return "邪能冲击"; return "法术冲击"; }
      if(ty==="ling"){ if(/骑|圣骑/.test(n)) return "圣光斩"; if(/牧|祭司/.test(n)) return "神圣惩戒"; return "圣光击"; }
      if(ty==="nature") return "藤棘鞭挞";
      if(ty==="blood") return "血能冲击";
      if(ty==="rage") return "狂暴打击";
      if(ty==="virus") return "病毒爆裂";
      if(ty==="erosion") return "蚀能撕咬";
      if(ty==="spirit"){ if(/催眠|眠|眼|算|脑/.test(n)) return "念动冲击"; if(/射|枪|弓|猎|狙/.test(n)) return "精准射击"; return "精神冲击"; }
      return "异能冲击";
    },
    /* 给一条推断/覆盖技能补全公共字段并生成 SKILL_DEF */
    _sigFinalize(slot, eng, sk, idx){
      const bs=this.branchScale(slot.branch), ps=this.priceScale(slot.price), tier=Math.max(slot.tier||0,this._sigTierWord(slot.name));
      const cap = eng.physical ? 100 : this.genericEnergyCap(slot.branch, slot.price);
      const def = { name:sk.name, type:eng.skillType, res:eng.physical?"stamina":eng.type, kind:sk.kind };
      if(eng.physical) def.powerStat="phys"; else def.powerStat=eng.powerStat||"mind";
      const tag = eng.physical ? this._sigShortName(slot.name) : (eng.name||"超能");
      const costE = Math.max(8, Math.round(cap*0.12));
      const costS = 6 + Math.round(2*bs);
      if(sk.kind==="summon"){
        // 豆包v176：召唤技——数值随支线档位；场上限优先取 desc「只能存在X只」
        const CN={一:1,两:2,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10};
        let capLimit=null; const cm=(slot.desc||"").match(/只能存在([一二两三四五六七八九十])只/);
        if(cm) capLimit=CN[cm[1]]; else capLimit=bs>=5?3:(bs>=3?2:1);
        const dt=(slot.name||"")+sk.name+(slot.desc||"");
        let nm="契约召唤兽";
        if(/骷髅|亡者|尸体|尸傀/.test(dt)) nm="骷髅战士";
        else if(/地狱犬/.test(dt)) nm="地狱犬";
        else if(/狼/.test(dt)) nm="召唤狼";
        else if(/元素/.test(dt)) nm="元素生物";
        else if(/结晶/.test(dt)) nm="结晶造物";
        else if(/凤凰/.test(dt)) nm="烈焰凤凰";
        else if(/幼龙|龙裔|巨龙/.test(dt)) nm="幼龙";
        else if(/蛛/.test(dt)) nm="巨蛛";
        else if(/天使/.test(dt)) nm="天使化身";
        else if(/恶魔|地狱/.test(dt)) nm="小恶魔";
        else if(/异|契约/.test(dt)) nm="异界契约兽";
        const sumHp=Math.round(70+26*bs+tier*12);
        const sumAtk=Math.round(11+3.2*bs+tier*1.6);
        const sumMagic=/亡灵|死灵|骷髅|亡者|尸体|尸傀|幽灵|暗影|恶魔|地狱|元素|结晶|凤凰|天使/.test(dt);
        def.kind="summon";
        def.summon={ key:"bl"+Math.abs(this._sigHash(slot.name)).toString(36).slice(-6),
          name:nm, count:1, hp:sumHp, atk:sumAtk, hit:0.06, crit:0.05, cap:capLimit, magic:sumMagic,
          line:"召唤出的"+nm+"扑向敌人" };
        def.cost=eng.physical?costS:costE; def.cd=15000; def.charge=34;
        def.desc=sk.desc||("【"+tag+"】缔结契约，召唤 1 只「"+nm+"」作为本次战斗的队友（生命 "+sumHp+" / 攻击 "+sumAtk+
          "，同源同时最多存活 "+capLimit+" 只）。它会自动出手，也会替你承伤，战斗结束即消散。"+(sumMagic?"召唤物为超自然体，可伤灵体。":""));
      } else if(sk.kind==="attack"){
        const grp = sk.tgt==="group";
        def.kind="attack"; def.tgt=sk.tgt||"single";
        def.base = sk.base!=null?sk.base : Math.round((grp?5+3*bs:7+4*bs) + tier*1.6);
        def.mult = sk.mult!=null?sk.mult : +(Math.min(0.22, 0.085*bs*ps + tier*0.008)).toFixed(3);
        def.hit = sk.hit!=null?sk.hit : (this._allText(sk,slot).match(/必中|要害|看破|弱点|天眼|狙击/)?0.22+0.02*tier:0.08);
        def.crit = sk.crit!=null?sk.crit : (this._allText(sk,slot).match(/暴击|要害|弱点|必杀/)?0.16+0.01*tier:0.08);
        def.critMult = sk.critMult||1.5;
        if(sk.armorPen) def.armorPen=sk.armorPen;
        def.cost = eng.physical?costS:costE; def.cd=4000+Math.round(bs*300); def.charge=grp?42:36;
        if(!eng.physical && eng.type==="mana") def.magic=true;
        def.lineScaleFromBlood = !eng.physical;
        def.desc = sk.desc || ("【"+tag+"】"+(sk.ef||"凝聚"+(eng.name||"力量")+"发动")+"。基础伤害 "+def.base+"，并随对应能力成长。");
      } else if(sk.kind==="heal"){
        def.heal = sk.heal!=null?sk.heal : +(Math.min(0.55,0.10+0.025*bs+tier*0.02)).toFixed(2);
        def.cost = eng.physical?Math.max(4,costS-2):Math.max(6,Math.round(cap*0.10)); def.cd=9000; def.charge=30;
        def.desc = sk.desc || ("【"+tag+"】"+(sk.ef||"运转力量恢复伤势")+"，回复约 "+Math.round(def.heal*100)+"% 生命。");
      } else if(sk.kind==="dodge"){
        def.dodgeMs = sk.dodgeMs||Math.round(2200+500*bs+tier*250);
        def.cost = eng.physical?costS:Math.max(8,Math.round(cap*0.12)); def.cd=8000; def.charge=28;
        def.desc = sk.desc || ("【"+tag+"】"+(sk.ef||"敛息闪身、规避打击")+"，"+(def.dodgeMs/1000)+" 秒内大幅降低被命中。");
      } else if(sk.kind==="buff"){
        def.buffMs=sk.buffMs||Math.round(8000+1500*bs);
        const atkBuff=!sk.defensive;
        def.hit=sk.hit!=null?sk.hit:(0.06+0.01*bs);
        def.crit=sk.crit!=null?sk.crit:(this._allText(sk,slot).match(/狂暴|狂战|暴击|天神|认真/)?0.12:0.05);
        def.chargeSpd=sk.chargeSpd!=null?sk.chargeSpd:(this._allText(sk,slot).match(/加速|飞行|冲锋|狂|神速|风/)?0.15:0.08);
        def.cost=eng.physical?costS:Math.max(8,Math.round(cap*0.12)); def.cd=12000; def.charge=30;
        def.desc=sk.desc||("【"+tag+"】"+(sk.ef||"短时间激发血统、强化自身")+"，期间命中/暴击/集气提升。");
      } else { // passive
        const defensive=sk.defensive;
        def.kind="passive"; def.res=null; def.cost=0; def.cd=0; def.charge=0;
        def.passive = sk.passive || (defensive
          ? { hit:0.02+0.004*bs, crit:0.02, dmg:0.05+0.015*bs+tier*0.01 }
          : { hit:this._allText(sk,slot).match(/看破|视力|视野|洞察/)?0.06+0.01*bs:0.03, crit:0.03, dmg:0.04+0.012*bs });
        def.desc=sk.desc||("【"+tag+"·被动】"+(sk.ef||"常驻强化")+"（命中/暴击/伤害提升，无需施放）。");
      }
      const sid="blgen_"+this._sigHash(slot.name+"|"+def.name+"|"+idx);
      return { sid:sid, def:def };
    },
    _allText(sk,slot){ return (sk.name||"")+" "+(sk.ef||"")+" "+(slot.name||"")+" "+(slot.desc||""); },
    /* 主编排：为一条通用血统生成 1~2 个签名技，写入 SKILL_DEF，返回 sid 列表（幂等） */
    buildGenericSigs(slot, eng){
      eng = eng || this.guessEnergy(slot.name);
      let raws = [];
      const ov = this.SIG_OVERRIDE[slot.name];
      if(ov && ov.length){
        raws = ov.map(o=>Object.assign({},o));
      } else {
        const parsed=this._sigParse(slot.desc);
        if(parsed.segs.length){
          parsed.segs.forEach(seg=>{
            const inf=this._sigInfer(seg, parsed.ef, slot);
            raws.push(Object.assign({name:seg, ef:parsed.ef}, inf));
          });
        } else {
          raws.push(Object.assign({ef:""}, this._sigFallback(slot, eng), this._sigInfer("", slot.desc||"", slot)));
        }
        // 全是被动/生活技时，补一个主题主动技，保证该血统在战斗里有事可做（召唤技也算主动技）
        if(!raws.some(r=>r.kind==="attack"||r.kind==="heal"||r.kind==="buff"||r.kind==="dodge"||r.kind==="summon")){
          raws.push(Object.assign({ef:"激发血统之力"}, this._sigFallback(slot,eng), {kind:"attack",tgt:"single"}));
        }
      }
      const sids=[];
      raws.slice(0,2).forEach((sk,i)=>{
        const f=this._sigFinalize(slot, eng, sk, i);
        WK.SKILL_DEF[f.sid]=f.def;
        sids.push(f.sid);
      });
      return sids;
    },
    genericEnergyCap(branch, price){
      let cap = 70;
      const s = String(branch||"").toUpperCase();
      if (/S/.test(s)) cap = 280;
      else if (/AA|2A/.test(s)) cap = 220;
      else if (/A/.test(s)) cap = 180;
      else if (/BB|2B/.test(s)) cap = 150;
      else if (/B/.test(s)) cap = 130;
      else if (/CC|2C/.test(s)) cap = 110;
      else if (/C/.test(s)) cap = 95;
      else if (/DD|2D/.test(s)) cap = 80;
      else cap = 70;
      cap += Math.min(40, Math.floor((Number(price)||0) / 800));
      return cap;
    },


    /* ===== 豆包v173：非血统能量池（修炼 / 魔法 / 机甲）=====
       血统能量存在 bloodlines.slots[].energy；内力(neili)/法力(mana)/机甲能(energy)也可能由
       非血统的修炼强化开启（如《初级/中级/高级气功》开启内力池）。统一放 p.energyPools，
       与血统能量经 energySources 合并 → syncRes 进 p.res → 供战斗技能消耗。 */
    POOL_META: {
      neili: { name:"内力", res:"neili", maxKey:"maxNeili" },
      mana:  { name:"法力", res:"mana",  maxKey:"maxMana" },
      energy:{ name:"能量", res:"energy",maxKey:"maxEnergy" }
    },
    ensurePools(p){
      p = p || WK.P;
      if (!p.energyPools || typeof p.energyPools !== "object") p.energyPools = {};
      return p.energyPools;
    },
    /* 开启 / 提升非血统能量池（max 为新上限；已存在则按原比例保留当前能量） */
    grantPool(key, max, src, dispName){
      const p = WK.P, meta = this.POOL_META[key];
      if (!meta) return false;
      const pools = this.ensurePools(p), old = pools[key];
      let cur;
      if (old && old.max > 0) cur = Math.round(Math.min(max, old.cur * (max / old.max)));
      else cur = max;
      pools[key] = { cur:cur, max:max, name:dispName || meta.name, src:src || null };
      this.syncRes(p);
      if (WK.save && WK.save.write) WK.save.write();
      return pools[key];
    },
    /* 合并血统能量 + 非血统能量池：{ key:{cur,max,name,parts:[底层对象...]} } */
    energySources(p){
      p = p || WK.P;
      const out = {};
      const add = (key, e) => {
        if (!e || !(e.max > 0)) return;
        if (!out[key]) out[key] = { cur:0, max:0, name:e.name || key, parts:[] };
        out[key].cur += (e.cur || 0);
        out[key].max += e.max;
        if (e.name) out[key].name = e.name;
        out[key].parts.push(e);
      };
      this.ensure(p).slots.forEach(s => { if (s.energy && s.energy.type) add(s.energy.type, s.energy); });
      const pools = this.ensurePools(p);
      Object.keys(pools).forEach(k => add(k, pools[k]));
      Object.keys(out).forEach(k => { out[k].cur = Math.min(out[k].cur, out[k].max); });
      return out;
    },
    /* 施放技能时统一扣能量：在该 key 的各底层来源（池 / 血统）依次扣减并回写 */
    spend(key, n){
      const p = WK.P, src = this.energySources(p)[key];
      if (!src) return false;
      let left = n;
      for (let i=0;i<src.parts.length && left>0;i++) {
        const e = src.parts[i], take = Math.min(e.cur || 0, left);
        e.cur = Math.max(0, (e.cur || 0) - take);
        left -= take;
      }
      this.syncRes(p);
      return left <= 0.0001;
    },
    hasEnergyType(type, p){
      p = p || WK.P;
      return !!this.energySources(p)[type];
    },
    hasBloodEnergy(p){ return this.hasEnergyType("blood", p); },

    primaryEnergy(type, p){
      p = p || WK.P;
      const bl = this.ensure(p);
      for (let i = 0; i < bl.slots.length; i++) {
        if (bl.slots[i].energy && bl.slots[i].energy.type === type) return bl.slots[i].energy;
      }
      // 豆包v173：血统里没有时回落到非血统能量池（内力/法力/机甲能）
      return this.ensurePools(p)[type] || null;
    },
    primaryBloodEnergy(p){ return this.primaryEnergy("blood", p); },

    /* 能量按上限百分比回复；战斗内外同一套。rate 如 0.004 = 每次 0.4% 上限 */
    regenAll(rate, inBattle){
      const p = WK.P;
      if (!p) return;
      rate = rate != null ? rate : 0.0025;
      const bl = this.ensure(p);
      bl.slots.forEach(function(s){
        if (s.energy && s.energy.max > 0) {
          s.energy.cur = Math.min(s.energy.max, (s.energy.cur || 0) + s.energy.max * rate);
        }
      });
      // 豆包v173：非血统能量池（内力/法力/机甲能）同样缓慢回复
      const __pools = this.ensurePools(p);
      Object.keys(__pools).forEach(k => {
        const e = __pools[k];
        if (e && e.max > 0) e.cur = Math.min(e.max, (e.cur || 0) + e.max * rate);
      });
      let regenRate = 0;
      // 豆包v175：再生分档（每秒按最大生命比例回血）。光合最弱，强再生次之，血族之心更快，巨魔断肢再生最猛
      const REGEN_TIERS = { photo_synth:0.0012, regen_strong:0.0015, regen_vampire:0.003, regen_troll:0.005 };
      bl.slots.forEach(function(s){
        if (!s.traits) return;
        s.traits.forEach(function(t){ if (REGEN_TIERS[t]) regenRate = Math.max(regenRate, REGEN_TIERS[t]); });
      });
      if (regenRate > 0 && p.hp > 0 && p.hp < p.maxHp) {
        const mul = inBattle ? 1 : 1.6;
        p.hp = Math.min(p.maxHp, p.hp + p.maxHp * regenRate * mul);
      }
      this.syncRes(p);
    },
    startPassiveRegen(){
      if (this._passiveTimer) return;
      const self = this;
      this._passiveTimer = setInterval(function(){
        if (!WK.P) return;
        // 战斗中由 _regenStamina 负责，避免双倍
        if (WK.battle && WK.battle.state && WK.battle.state.active) return;
        self.regenAll(0.003, false);
        if (WK.GeneLock) WK.GeneLock.tickPenalty(Date.now());
      }, 1000);
    },
    /* 豆包v173：同步【全部】能量（血统 7 系 + 非血统 mana/neili/energy）到 p.res */
    syncRes(p){
      p = p || WK.P;
      if (!p.res) p.res = {};
      const sources = this.energySources(p);
      ["blood","rage","virus","spirit","nature","erosion","ling","mana","neili","energy"].forEach(t => {
        const e = sources[t];
        const maxKey = "max" + t.charAt(0).toUpperCase() + t.slice(1);
        if (e) {
          p.res[t] = e.cur;
          p.res[maxKey] = e.max;
          if (t === "blood") p.res.maxBlood = e.max;   // 兼容旧字段
        } else {
          p.res[t] = 0;
          p.res[maxKey] = 0;
        }
      });
    },

    skillIdByName(name){
      const map = {
        "血族法术-鲜血视觉": "blood_sight",
        "血族法术-红炎": "blood_flame",
        "血族法术-黑暗狩猎": "blood_darkhunt",
        "血族法术-鲜血之矛": "blood_spear",
        "血族法术-血色暴雨": "blood_rain",
        "血族法术-化身蝙蝠": "blood_bat"
      };
      return map[name] || null;
    },

    hasName(name){
      const bl = this.ensure();
      return bl.slots.some(s => s.name === name || s.id === name);
    },

    hasReq(req){
      if (!req) return true;
      const r = String(req).trim();
      if (!r) return true;
      // 能量类前置第1期只做标记提示，不拦截（能量系统第2期）
      if (/能量|天赋|基因锁/.test(r) && !/血统|模板|基因|男爵|子爵|伯爵|初级|中级|高级/.test(r)) {
        return true;
      }
      // 豆包v164【P2】抽象条件「任意血统」——已拥有至少一个血统即满足
      if (/任意血统|任一血统|拥有.{0,4}血统|任一强化/.test(r)) return this.ensure().slots.length > 0;
      if (this.hasName(r)) return true;
      // 豆包v164【P2】容错匹配：req 列与血统名导入时常差「血统/模板」后缀或缺「武器」等中缀，
      // 按「档位词一致 + 核心词互为包含」判满足（核心至少3字，防止「死神」误匹配「死神代行者」）。
      return this.ensure().slots.some(s => this._reqMatch(r, s.name));
    },
    /* 豆包v164【P2】血统名规范化：去空白与体系尾缀，只留档位+核心 */
    _normBloodName(s){
      let x = String(s || "").replace(/\s+/g, "");
      x = x.replace(/(变异血统|基因变异|进化模式|强化基因|变异|血统|模板|基因)/g, "");
      return x;
    },
    _BLOOD_TIER_RE: /(最终|特级|高阶|高级|中阶|中级|低阶|初级|初阶|见习|帝王|亲王|侯爵|伯爵|子爵|男爵|使者|大师)/,
    _reqMatch(reqName, ownedName){
      const a = this._normBloodName(reqName), b = this._normBloodName(ownedName);
      if (!a || !b) return false;
      if (a === b) return true;
      const re = this._BLOOD_TIER_RE;
      const ta = (a.match(re) || [])[0] || "";
      const tb = (b.match(re) || [])[0] || "";
      const ca = a.replace(new RegExp(re.source, "g"), "");
      const cb = b.replace(new RegExp(re.source, "g"), "");
      if (ca.length < 3 || cb.length < 3) return false;   // 核心过短不做包含匹配，避免误伤
      return ta === tb && (ca.indexOf(cb) >= 0 || cb.indexOf(ca) >= 0);
    },
    /* 豆包v164【P2】前置血统是否在库中存在（用于区分「未满足」与「前置整片尚未开放」）*/
    reqAvailable(req){
      if (!req) return true;
      const r = String(req).trim();
      if (/任意血统|任一血统|拥有.{0,4}血统|任一强化/.test(r)) return true;
      if (/能量|天赋|基因锁/.test(r) && !/血统|模板|基因/.test(r)) return true;
      const names = Object.keys(WK.BLOOD_DB || {});
      if (names.indexOf(r) >= 0) return true;
      return names.some(n => this._reqMatch(r, n));
    },

    /* 文案：按价位/支线生成「郑吒式」主神光柱段落 */
    narrFor(meta){
      const price = meta.price || 0;
      const name = meta.name || "未知血统";
      const heavy = price >= 3000 || (meta.branch && /[SAB]/.test(String(meta.branch)));
      const mid = price >= 1000;
      const lines = [];
      lines.push("你将兑换「" + name + "」的意图告知主神。");
      if (heavy) {
        lines.push("刹那间，一道光柱自光球上射下，将你整个人笼罩其中。你仿佛泡在热水里，暖意从四肢百骸渗入，一股气息下沉到小腹，另一股上升进脑际，意识懒洋洋地几乎要睡过去。");
        lines.push("无数细小的光粒从光柱中连续射入体内，骨骼与血肉在重组的嗡鸣里轻轻发颤。你悬浮在半空数米高处，周围队友只能目瞪口呆地看着这一幕。");
        lines.push("数分钟后，你缓缓落回地面。身上似乎多了一层难以名状的气质——那是血统落成后，主神写入生命底层的印记。");
      } else if (mid) {
        lines.push("光球亮起柔和的光柱，细密的光粒落在你肩头与胸口，像温水洗过筋骨。肌肉、神经与细胞在无声中被改写。");
        lines.push("片刻之后光柱收束。你站稳脚步，能清晰感觉到身体某处被「打开」了——新的血统已经在你体内生根。");
      } else {
        lines.push("主神降下薄薄一层光幕，光粒点点没入皮肤。强化并不夸张，却足够让你在下一次生死里多一分底气。");
        lines.push("光幕散去，「" + name + "」的印记已写入你的生命信息。");
      }
      if (meta.attrs && Object.keys(meta.attrs).length) {
        const map = { mus:"肌肉组织强度", ner:"神经反应速度", int:"智力", spi:"精神力", cel:"细胞活力", imm:"免疫力强度" };
        const parts = [];
        Object.keys(meta.attrs).forEach(k => {
          if (meta.attrs[k]) parts.push(map[k] + "+" + meta.attrs[k]);
        });
        if (parts.length) lines.push("身体素质变化：" + parts.join("，") + "。");
      }
      return lines;
    },

    /* 进度条仪式：动画结束后 callback */
    playRitual(meta, onDone){
      const ov = document.getElementById("ov-blood-ritual");
      const title = document.getElementById("br-title");
      const narr = document.getElementById("br-narr");
      const bar = document.getElementById("br-bar-fill");
      const pct = document.getElementById("br-pct");
      if (!ov) { onDone && onDone(); return; }

      const lines = this.narrFor(meta);
      const totalMs = Math.min(9000, 3200 + Math.min(5000, (meta.price || 0) * 0.8));
      title.textContent = "血统加载中 · " + (meta.name || "");
      narr.textContent = lines[0] || "";
      bar.style.width = "0%";
      pct.textContent = "0%";
      ov.classList.add("active");
      ov.setAttribute("aria-hidden", "false");

      let t0 = Date.now();
      let lineIdx = 0;
      const step = () => {
        const t = Date.now() - t0;
        const p = Math.min(1, t / totalMs);
        bar.style.width = (p * 100).toFixed(1) + "%";
        pct.textContent = Math.floor(p * 100) + "% · 主神写入中";
        // 分段换文案
        const seg = Math.min(lines.length - 1, Math.floor(p * lines.length));
        if (seg !== lineIdx) {
          lineIdx = seg;
          narr.textContent = lines[lineIdx];
        }
        if (p < 1) {
          requestAnimationFrame(step);
        } else {
          narr.textContent = lines[lines.length - 1] || narr.textContent;
          pct.textContent = "100% · 血统已落成";
          setTimeout(() => {
            ov.classList.remove("active");
            ov.setAttribute("aria-hidden", "true");
            onDone && onDone();
          }, 600);
        }
      };
      requestAnimationFrame(step);
    },

    /* 真正写入存档 */
    apply(meta, cat){
      const p = WK.P;
      const bl = this.ensure(p);
      const id = (cat && cat.id) || ("bl_" + (meta.name || "x"));
      const line = meta.line || this.detectLine(meta.name || "") || "custom";
      const slot = {
        id: id,
        name: meta.name,
        line: line,
        tier: meta.tier || 0,
        attrs: Object.assign({}, meta.attrs || {}),
        desc: meta.desc || (cat && cat.desc) || "",
        branch: meta.branch || (cat && cat.branch) || null,
        price: meta.price != null ? meta.price : (cat && cat.price),
        energy: null,
        skills: [],
        traits: []
      };
      // v161：按血统系写入能量 / 特质 / 签名技能
      slot.line = this.detectLine(meta.name || slot.name);
      // 豆包v173：BLOOD_DB 里 line 以 "custom_" 开头表示「未归入标准 27 系」，应交给 detectLine 重新归类
      // （旧逻辑只排除恰好等于 "custom"，导致 "custom_火元素师…" 绕过 LINE_DEFS、掉进通用分支乱配能量）。
      if (meta.line && !/^custom/.test(meta.line)) slot.line = meta.line;
      this.applyLineProfile(slot);
      // 签名技能写入 p.skills
      if (slot.skills && slot.skills.length) {
        p.skills = p.skills || {};
        slot.skills.forEach(sid => {
          if (WK.SKILL_DEF[sid] && !p.skills[sid]) p.skills[sid] = { level: 1 };
        });
      }
      // 同系替换（保留技能与能量比例）
      if (line && bl.lines[line]) {
        const oldSlot = bl.slots.find(s => s.id === bl.lines[line] || s.line === line);
        if (oldSlot && oldSlot.energy && slot.energy) {
          const ratio = oldSlot.energy.max ? (oldSlot.energy.cur / oldSlot.energy.max) : 1;
          slot.energy.cur = Math.round(slot.energy.max * Math.min(1, ratio));
        }
        if (oldSlot && oldSlot.skills && oldSlot.skills.length) slot.skills = oldSlot.skills.slice();
        const oldId = bl.lines[line];
        bl.slots = bl.slots.filter(s => s.id !== oldId && s.line !== line);
      }
      bl.slots.push(slot);
      if (line) bl.lines[line] = slot.id;
      p.bloodline = slot;
      this.syncRes(p);
      if (WK.save && WK.save.write) WK.save.write();
      return slot;
    },

    /* 兑换血族法术（需已有血族能量） */
    buyBloodSkill(cat){
      if (!cat) return false;
      const p = WK.P;
      if (!this.hasBloodEnergy(p)) {
        WK.toast("需要先兑换血族血统以获得「血族能量」", "bad");
        return false;
      }
      const sid = this.skillIdByName(cat.name);
      if (!sid || !WK.SKILL_DEF[sid]) {
        WK.toast("该血族法术将在后续版本实装：" + (cat.name || ""), "gold");
        return false;
      }
      p.skills = p.skills || {};
      if (p.skills[sid]) { WK.toast("已掌握「" + WK.SKILL_DEF[sid].name + "」", "good"); return false; }

      // 扣费
      if (!p.branch) p.branch = { S:0, A:0, B:0, C:0, D:0 };
      let price = cat.price;
      if (price == null || price < 0) price = cat.branch ? 0 : -1;
      if (price < 0) { WK.toast("无法定价", "bad"); return false; }

      let needN = 0, needLetter = null;
      if (cat.branch) {
        const s = String(cat.branch).toUpperCase().replace(/\s/g, "");
        const m = s.match(/^(\d+)?([SABCD])$/);
        if (m) { needN = parseInt(m[1] || "1", 10); needLetter = m[2]; }
        else if (s === "DD" || s === "2D") { needN = 2; needLetter = "D"; }
        else if (s === "CC" || s === "2C") { needN = 2; needLetter = "C"; }
        else if (s === "BB" || s === "2B") { needN = 2; needLetter = "B"; }
        else { needLetter = s.replace(/[^SABCD]/g, "") || "D"; needN = 1; }
        if ((p.branch[needLetter] || 0) < needN) {
          WK.toast("支线不足：需要 " + needLetter + "×" + needN, "bad");
          return false;
        }
      }
      if (price > 0 && (p.points || 0) < price) { WK.toast("奖励点不足", "bad"); return false; }
      if (needLetter) p.branch[needLetter] -= needN;
      if (price > 0) {
        if (WK.SHOP && WK.SHOP._charge) {
          if (!WK.SHOP._charge(price, "血族法术 · " + cat.name)) {
            if (needLetter) p.branch[needLetter] += needN;
            return false;
          }
        } else p.points -= price;
      }

      p.skills[sid] = { level: 1 };
      const bl = this.ensure(p);
      bl.slots.forEach(s => {
        if (s.energy && s.energy.type === "blood") {
          s.skills = s.skills || [];
          if (s.skills.indexOf(sid) < 0) s.skills.push(sid);
        }
      });
      this.syncRes(p);
      if (WK.save && WK.save.write) WK.save.write();
      WK.toast("掌握血族法术「" + WK.SKILL_DEF[sid].name + "」", "gold");
      if (WK.SHOP && WK.SHOP.render) WK.SHOP.render();
      return true;
    },

    /* 从商店入口：扣费后播动画再写入 */
    buyFromShop(cat){
      if (!cat) { WK.toast("无效血统", "bad"); return false; }
      const meta = this.findByName(cat.name) || {
        name: cat.name,
        price: cat.price,
        branch: cat.branch,
        req: cat.req,
        desc: cat.desc,
        attrs: (cat.stats && cat.stats.attrs) || {},
        line: "custom",
        tier: 0
      };
      // 前置
      if (meta.req && !this.hasReq(meta.req)) {
        // 豆包v164【P2】前置在库中根本不存在 → 属尚未开放的进阶链，而非玩家没买
        WK.toast(this.reqAvailable(meta.req)
          ? ("前置未满足：需先拥有「" + meta.req + "」")
          : ("前置【" + meta.req + "】将在后续恐怖片开放，暂无法兑换"), "bad");
        return false;
      }
      // 已拥有同名
      if (this.hasName(meta.name)) {
        WK.toast("已拥有该血统", "good");
        return false;
      }

      // 支线 + 点数：复用 SHOP 解析逻辑的简化版
      const p = WK.P;
      if (!p.branch) p.branch = { S:0, A:0, B:0, C:0, D:0 };
      let price = cat.price;
      if (price == null || price < 0) {
        if (cat.branch) price = 0;
        else { WK.toast("无法定价", "bad"); return false; }
      }
      // 先校验支线与点数，再扣费（避免扣了支线却点数不够）
      let needN = 0, needLetter = null;
      if (cat.branch || meta.branch) {
        const br = cat.branch || meta.branch;
        const s = String(br).toUpperCase().replace(/\s/g, "");
        needN = 1; needLetter = s;
        const m = s.match(/^(\d+)?([SABCD])$/);
        if (m) { needN = parseInt(m[1] || "1", 10); needLetter = m[2]; }
        else if (s === "DD") { needN = 2; needLetter = "D"; }
        else if (s === "CC") { needN = 2; needLetter = "C"; }
        else if (s === "BB") { needN = 2; needLetter = "B"; }
        else if (s === "AA") { needN = 2; needLetter = "A"; }
        else if (s === "SS") { needN = 2; needLetter = "S"; }
        if ((p.branch[needLetter] || 0) < needN) {
          WK.toast("支线不足：需要 " + needLetter + "×" + needN, "bad");
          return false;
        }
      }
      if (price > 0 && (p.points || 0) < price) {
        WK.toast("奖励点不足", "bad");
        return false;
      }
      if (needLetter) p.branch[needLetter] -= needN;
      if (price > 0) {
        if (WK.SHOP && WK.SHOP._charge) {
          if (!WK.SHOP._charge(price, "血统兑换 · " + meta.name)) {
            // 退支线
            if (needLetter) p.branch[needLetter] += needN;
            return false;
          }
        } else {
          p.points -= price;
        }
      }

      // 先关商店详情，再播仪式
      if (WK.ui && WK.ui.closeOverlay) WK.ui.closeOverlay("ov-generic");
      const self = this;
      this.playRitual(meta, function(){
        const slot = self.apply(meta, cat);
        WK.toast("「" + slot.name + "」已写入生命信息", "gold");
        if (WK.SHOP && WK.SHOP.render) WK.SHOP.render();
        if (WK.renderScene) WK.renderScene();
      });
      return true;
    },

    /* 汇总所有血统六维（供战斗 / 面板） */
    totalAttrs(p){
      p = p || WK.P;
      const out = { mus:0, ner:0, int:0, spi:0, cel:0, imm:0 };
      const bl = this.ensure(p);
      bl.slots.forEach(s => {
        const a = s.attrs || {};
        Object.keys(out).forEach(k => { out[k] += (a[k] || 0); });
        if (s.bodyAlloc) {
          Object.keys(out).forEach(k => { out[k] += (s.bodyAlloc[k] || 0); });
        }
      });
      return out;
    },

    TRAIT_LABEL: {
      regen_strong:"强再生", no_sun_fear:"不惧阳光与银", regen_troll:"巨魔级再生", photo_synth:"光合作用",
      night_boost:"夜战强化", virus_adapt:"病毒适应", wall_crawl:"壁虎游墙", fog_affinity:"雾都亲和",
      detective:"推理加成", psychic:"强韧精神", sharpshoot:"精准之眼", faith:"信仰加护",
      ling_cycle:"灵力循环", erosion:"蚀之力亲和", pollen:"花粉毒素", aquatic:"水栖", bloodline_power:"天赋异能",
      // 豆包v175 新增机制 / 数值特质
      regen_vampire:"血族之心", lifesteal:"血族之牙·吸血", plague_immune:"不染瘟疫", poison_immune:"毒素免疫",
      fire_immune:"烈焰不侵", cold_immune:"寒霜不侵", magic_immune:"魔法免疫", magic_resist:"魔法抗性",
      phys_hardy:"强韧躯体", night_fighter:"暗夜作战", swift:"迅捷", flyer:"制空"
    },

    /* 豆包v175：特质【量化效果说明】——血统卡详情逐条展示。
       数值必须与真实战斗结算一致：回血=战斗 tick(100ms) 每跳 REGEN_TIERS，即每秒 ×10；
       减伤/免疫在 _enemyAttack，吸血在 _lifesteal，stats 在 WK.BLOOD_TRAITS。改数值时两处同步。 */
    TRAIT_DESC: {
      regen_vampire:"战斗中每秒约回复 3% 生命；只要心脏未碎，每场战斗首次受到致命伤时保留 1 点生命。",
      regen_troll:"战斗中每秒约回复 5% 生命，断肢残躯也能极快再生。",
      regen_strong:"战斗中每秒约回复 1.5% 生命，伤口快速愈合。",
      photo_synth:"借光合作用，战斗中每秒约回复 1.2% 生命。",
      lifesteal:"攻击命中后，吸取所造成伤害 8% 的生命。",
      phys_hardy:"受到的物理伤害减免 28%，生命上限 +40、护甲 +3。",
      plague_immune:"免疫 T 病毒感染与毒素，生命上限 +15。",
      poison_immune:"免疫毒素类伤害与中毒状态。",
      fire_immune:"受到火焰攻击时完全免疫，不掉血。",
      cold_immune:"受到冰冻攻击时完全免疫，不被冻结。",
      magic_immune:"受到魔法攻击时完全免疫，不掉血。",
      magic_resist:"受到的魔法伤害减半。",
      virus_adapt:"与病毒共生，不会被 T 病毒感染。",
      no_sun_fear:"不惧阳光与银器，没有普通血族的致命弱点。",
      night_fighter:"夜间 / 黑暗中作战：命中 +5%、暴击 +3%。",
      night_boost:"暗夜环境：命中 +4%、暴击 +2%。",
      sharpshoot:"远程专精：命中 +6%、暴击 +4%。",
      psychic:"精神凝聚：命中 +3%、暴击 +2%。",
      swift:"身法迅捷：集气速度 +8%、命中 +3%。",
      flyer:"空中机动：集气速度 +4%、命中 +2%。",
      blood_fang:"攻击 +5、命中 +4%（血族吸血潜能，配合血族之牙）。",
      body_boost:"身体素质小幅提升：攻击 +3。",
      phys_resist:"物理抗性：护甲 +2。",
      speed:"出手更快：集气速度 +8%、命中 +3%。",
      recover:"细胞活力提升：生命上限 +10。"
    },

    /* 豆包v173：纯预览（不写存档）——给商店血统卡展示：能量体系 / 六维 / 特质 / 授予技能 / 前置 */
    preview(cat){
      const meta = this.findByName(cat.name) || {
        name: cat.name, attrs: (cat.stats && cat.stats.attrs) || {}, desc: cat.desc, branch: cat.branch, req: cat.req
      };
      let line = meta.line;
      if (!line || /^custom/.test(line)) line = this.detectLine(meta.name || "");
      const def = this.LINE_DEFS[line];
      const tk = this.detectTierKey(meta.name || "");
      let energyName = null, energyType = null, cap = 0, physical = false;
      if (def && def.energy) {
        energyType = def.energy; energyName = def.energyName || def.energy;
        cap = this.energyCapFor({ name: meta.name, line: line });
      } else if (!def) {
        const eg = this.guessEnergy(meta.name);
        if (eg.physical) {
          // 纯肉身 / 近战血统：无独立能量池，技能耗体力
          physical = true; energyType = null; energyName = "体魄·近战"; cap = 0;
        } else {
          energyType = eg.type; energyName = eg.name;
          cap = this.genericEnergyCap(meta.branch || cat.branch, meta.price != null ? meta.price : cat.price);
        }
      }
      // 豆包v175：与 applyLineProfile 一致——标准系手工 traits 之上再合并名称/描述推断出的机制特质
      const traits = (def ? (def.traits || []).slice() : []).concat(
        this.guessTraits(meta.name, meta.desc).filter(k => (def ? (def.traits || []) : []).indexOf(k) < 0)
      );
      let skillIds = [];
      if (def && def.grantSkills) {
        const g = def.grantSkills;
        if (g._all) skillIds = skillIds.concat(g._all);
        if (tk && g[tk]) skillIds = skillIds.concat(g[tk]);
        if (["高级","特级","最终","使者","高阶","宗师","大师"].indexOf(tk) >= 0) {
          if (g["中级"]) skillIds = skillIds.concat(g["中级"]);
          if (g["中阶"]) skillIds = skillIds.concat(g["中阶"]);
          if (g["高级"]) skillIds = skillIds.concat(g["高级"]);
        }
      }
      // 豆包v174：通用血统 dry-run 签名技引擎，拿到原著技能名供卡片展示（不落盘 p.skills；SKILL_DEF 写入幂等）
      let sigNames = [];
      if (!def) {
        const eg0 = this.guessEnergy(meta.name);
        const tmpSlot = { name:meta.name, desc:meta.desc, branch:meta.branch||cat.branch,
          price:(meta.price != null ? meta.price : cat.price), tier:meta.tier||0 };
        sigNames = this.buildGenericSigs(tmpSlot, eg0)
          .map(sid => WK.SKILL_DEF[sid] ? WK.SKILL_DEF[sid].name : null).filter(Boolean);
      }
      return {
        line: line, lineLabel: def ? def.label : null, tier: tk,
        energyType: energyType, energyName: energyName, energyCap: cap, physical: physical,
        attrs: meta.attrs || {}, traits: traits, skillIds: skillIds, sigNames: sigNames, generic: !def,
        req: meta.req || null
      };
    },

    panelHtml(){
      const bl = this.ensure();
      this.syncRes();
      const __pools = this.ensurePools();
      const __poolKeys = Object.keys(__pools).filter(k => __pools[k] && __pools[k].max > 0);
      if (!bl.slots.length && !__poolKeys.length) {
        return '<div style="color:var(--dim);font-size:13px;line-height:1.7;">尚未兑换血统。请在主神「辅助类」中检索血统 / 基因 / 模板。<br>示例：搜索「血族男爵」→ 获得血族能量后可兑换「血族法术-红炎」等。</div>';
      }
      let h = "";
      bl.slots.forEach(s => {
        const a = s.attrs || {};
        const parts = [];
        const map = { mus:"肌肉", ner:"神经", int:"智力", spi:"精神", cel:"细胞", imm:"免疫" };
        Object.keys(map).forEach(k => { if (a[k]) parts.push(map[k] + "+" + a[k]); });
        h += '<div style="margin:8px 0;padding:10px 12px;border:1px solid var(--line2);border-radius:8px;background:var(--panel2);">' +
          '<div style="color:var(--gold);font-size:14px;margin-bottom:4px;">' + (s.name || s.id) + '</div>';
        if (s.energy) {
          const en = s.energy.name || s.energy.type || "能量";
          h += '<div style="font-size:12.5px;color:#e08090;margin-bottom:4px;">' + en + ' ' +
            Math.round(s.energy.cur) + ' / ' + s.energy.max + '</div>';
        }
        if (s.traits && s.traits.length) {
          const tmap = {
            regen_strong:"强再生（脑心未毁可持续复原）", no_sun_fear:"不惧阳光与银",
            regen_troll:"巨魔级再生", photo_synth:"光合作用", night_boost:"夜战强化",
            virus_adapt:"病毒适应", wall_crawl:"壁虎游墙", fog_affinity:"雾都亲和",
            detective:"推理加成", psychic:"精神感应", sharpshoot:"魔弹专精",
            faith:"信仰加护", ling_cycle:"灵力循环", erosion:"蚀之力亲和", pollen:"花粉毒素"
          };
          const tl = s.traits.map(t => tmap[t] || t).join(" · ");
          h += '<div style="font-size:12px;color:#8fd0a0;margin-bottom:4px;">特质：' + tl + '</div>';
        }
        if (s.skills && s.skills.length) {
          const sn = s.skills.map(id => (WK.SKILL_DEF[id] && WK.SKILL_DEF[id].name) || id).join("、");
          h += '<div style="font-size:12px;color:#c8b07a;margin-bottom:4px;">已掌握法术：' + sn + '</div>';
        }
        h += (s.desc ? '<div style="font-size:12px;color:var(--dim);line-height:1.65;margin-bottom:6px;">' + String(s.desc).slice(0, 120) + (s.desc.length > 120 ? "…" : "") + '</div>' : '') +
          (parts.length ? '<div style="font-size:12.5px;color:#c8d6c8;">' + parts.join(" · ") + '</div>' : '') +
          '</div>';
      });
      // 豆包v173：非血统能量池（内力 / 法力 / 机甲能，由气功等修炼强化开启）
      __poolKeys.forEach(k => {
        const e = __pools[k], meta = this.POOL_META[k] || { name:"能量" };
        h += '<div style="margin:8px 0;padding:10px 12px;border:1px solid var(--line2);border-radius:8px;background:var(--panel2);">' +
          '<div style="color:var(--gold);font-size:14px;margin-bottom:4px;">' + meta.name + '修为 <span style="font-size:11px;color:#7fb8d8;">非血统能量</span></div>' +
          '<div style="font-size:12.5px;color:#8fd0e0;margin-bottom:4px;">' + meta.name + ' ' + Math.round(e.cur) + ' / ' + e.max + '</div>' +
          '<div style="font-size:12px;color:var(--dim);">来源：修炼强化（如气功），随时间缓慢恢复，供' + meta.name + '类技能消耗。</div></div>';
      });
      return h;
    }
  };


  WK.SHOP = {
    tab:"other",
    filterQuery:"",  // 豆包v144：主神检索关键词
    _subFilter:{},     // 豆包v178：科技/魔法页子筛选桶（key=tab）

    /* 豆包v142：严格按 lon 设定的六大选项卡（顺序勿动，大表按此映射）：
       1 科技类  2 传说魔法类  3 辅助类  4 娱乐类  5 血统兑换  6 其他
       属性强化 / 全身修复 / 本世界素材回收 / 主神造人 / 队长权限项 全部收进「其他」。 */
    TABS:[
      {id:"tech",  name:"科技类"},
      {id:"magic", name:"传说魔法类"},
      {id:"aux",   name:"辅助类"},
      {id:"fun",   name:"娱乐类"},
      {id:"other", name:"其他"}
    ],

    /* 原著六维（普通人均值 100）。字段对应 P.attrs；每 +1 点收费 1 奖励点 */
    ATTRS:[
      {k:"int", name:"智力",         sub:"悟性 · 学习"},
      {k:"spi", name:"精神力",       sub:"意志 · 法力上限"},
      {k:"cel", name:"细胞活力",     sub:"生命 · 恢复力"},
      {k:"ner", name:"神经反应速度", sub:"命中 · 集气 · 闪避"},
      {k:"mus", name:"肌肉组织强度", sub:"物理伤害 · 负重"},
      {k:"imm", name:"免疫力强度",   sub:"抗 T 病毒 · 毒素"}
    ],

    /* 可购商品。skill=对应 WK.SKILL_DEF id（购买写入 P.skills）；
       纯强化/消耗品用 id + buy() 自定义效果。price 单位＝奖励点。 */
    ITEMS:[
      /* —— 科技·技能（写入 P.skills）—— */
      {tab:"tech", icon:"枪", type:"firearm", skill:"deagle",        price:100,
        name:"沙漠之鹰（技能）", desc:"战斗技能：单发高伤、高爆头。数值：base55 命中+15% 暴击+35%。另可购实体「沙漠之鹰」装入武器槽。"},
      {tab:"tech", icon:"扫", type:"firearm", skill:"smg",           price:150,
        name:"冲锋枪·火力压制", desc:"战斗技能：整组扫射。适合清丧尸群。"},
      {tab:"tech", icon:"准", type:"firearm", skill:"shoot_mastery", price:200,
        name:"高级射击精通", desc:"被动：全体枪械命中+8%、爆头率+10%。"},
      /* —— 辅助 —— */
      {tab:"aux",  icon:"愈", type:"aux",     skill:"medspray",      price:80,
        name:"急救喷雾（技能）", desc:"战斗技能：一次恢复约 60% 生命。"},
      {tab:"aux",  icon:"心", type:"base", id:"vit_hp",  price:100,
        name:"生命强化", desc:"生命上限 +20，并立即恢复到满血。可多次购买。"},
      {tab:"aux",  icon:"力", type:"base", id:"vit_sta", price:100,
        name:"体力强化", desc:"体力上限 +30，并立即回满体力。可多次购买。"},
      {tab:"aux",  icon:"毒", type:"base", id:"antiviral", price:30, consumable:true,
        name:"抗病毒血清", desc:"购入一支随身携带。感染后注射可清除 T 病毒，也是原液冲击基因锁的收束剂。"},
      {tab:"aux",  icon:"戒", type:"base", id:"ring_naring", price:800, unique:true, equip:true,
        name:"纳戒（空间装备）", desc:"【装备·戒指】随身容量 +30 格。购入后自动计入容量；可在装备页装入戒指槽。"}
    ],

    /* —— 豆包v142：等 lon 兑换大表填入的「数据骨架」——
       · 科技/辅助：现有可兑换项放在上面 ITEMS（tab:"tech"/"aux"），大表新增照同一格式追加即可：
           {tab:"tech", icon:"字", type:"firearm", skill或id, price, branch:"D"(可选，需要支线时加), name, desc}
       · 传说魔法 / 娱乐：大表来之前只给锁定预览（PREVIEW），不在售卖；
       · 血统：BLOODLINES 暂为空数组，大表来后填 {id,name,price,branch,desc,grant}，渲染/购买逻辑已在 _renderBlood 备好。 */
    BLOODLINES:[
      /* 豆包v143：模板类最小可玩子集——基础血统 + D 级身体素质（对应 Excel「模板类」）*/
      { id:"base_blood", name:"基础血统模板", price:0, branch:"D",
        desc:"【模板】开启血统栏。本集凡人模板：无额外能量。兑换后可再购「身体素质」强化。效果：解锁血统系统（不叠属性）。",
        grant: function(p){ p.bloodline = p.bloodline || { id:"base_blood", name:"基础血统模板", energyType:null, bodyPts:0, traits:[] }; } },
      { id:"body_d_gen", name:"通用身体素质·D级", price:500, branch:"D",
        desc:"【模板】提升 100 点身体素质（折算：攻击约+10，生命上限约+20）。需已有基础血统模板。",
        needBlood:"base_blood",
        grant: function(p){
          if (!p.bloodline) p.bloodline = { id:"base_blood", name:"基础血统模板", energyType:null, bodyPts:0, traits:[] };
          p.bloodline.bodyPts = (p.bloodline.bodyPts||0) + 100;
          p.maxHp = (p.maxHp||100) + 20; p.hp = Math.min(p.hp+20, p.maxHp);
        } }
    ],

    /* 豆包v167：旧的「高阶体系锁定预览」PREVIEW 数组（烈火道符/中国气功/重装机甲/回归现实天数
       四张框架占位卡）已删除——它们不在 lon 的兑换大表里，且旧卡片模板在重做后的商店里竖排错乱。
       魔法/武功/机甲条目改由 CATALOG 正式大表提供；时间回归在「其他」页（队长权限置灰/演示）。 */

    p(){ return WK.P; },
    ownedSkill(id){ const p=this.p(); return !!(p.skills && p.skills[id]); },
    itemCount(id){ const p=this.p(); return (p.items && p.items[id])||0; },

    open(tab){
      if(tab) this.tab=tab;
      // 血统已并入辅助类，旧入口 blood 自动转到 aux
      if(this.tab==="blood") this.tab="aux";
      document.getElementById("ov-shop").classList.add("active");
      this.renderTabs(); this.render();
    },
    close(){ WK.ui.closeOverlay("ov-shop"); },

    renderTabs(){
      document.getElementById("shop-tabs").innerHTML=this.TABS.map(t=>
        '<button class="ov-tab'+(this.tab===t.id?" active":"")+'" onclick="WK.SHOP.switchTab(\''+t.id+'\')">'+t.name+'</button>').join("");
    },
    _fmtBranch(br){
      if (!br) return "";
      const s = String(br).toUpperCase().replace(/\s/g, "");
      const m = s.match(/^(\d+)?([SABCD])$/);
      if (m) {
        const n = parseInt(m[1] || "1", 10);
        return n > 1 ? (m[2] + "×" + n) : m[2];
      }
      if (s === "DD" || s === "双D") return "D×2";
      if (s === "CC" || s === "双C") return "C×2";
      if (s === "BB" || s === "双B") return "B×2";
      if (s === "AA" || s === "双A") return "A×2";
      if (s === "SS" || s === "双S") return "S×2";
      return s;
    },
    /* 豆包v165：把支线需求（"D"/"2D"/"DD"/"2C+B"…）解析成 {档位:数量}；DD 视作两个 D */
    _branchNeed(br){
      const need = {};
      if (!br) return need;
      const s = String(br).toUpperCase().replace(/\s/g, "");
      const re = /(\d*)([SABCD])/g; let m;
      while ((m = re.exec(s))) {
        const cnt = parseInt(m[1] || "1", 10);
        need[m[2]] = (need[m[2]] || 0) + cnt;
      }
      return need;
    },
    /* 玩家当前支线是否不足以支付 br（任一档位持有 < 需求即 true）*/
    _branchLack(br){
      if (!br) return false;
      const have = (this.p() && this.p().branch) || {}, need = this._branchNeed(br);
      return Object.keys(need).some(k => (have[k] || 0) < need[k]);
    },
    switchTab(id){
      this.tab=id;
      this.renderTabs();
      try { this.render(); }
      catch (e) {
        console.error("SHOP render", e);
        const body = document.getElementById("shop-body");
        if (body) body.innerHTML = this.walletHtml() + '<div class="shop-note">本页渲染出错：'+(e && e.message ? e.message : e)+'。可尝试用检索缩小列表。</div>';
      }
    },

    /* 顶部资产条 + 全身修复（所有 Tab 常驻）*/
    walletHtml(){
      const p=this.p(), br=p.branch||{};
      const brTxt=["S","A","B","C","D"].map(k=>k+(br[k]||0)).join(" ");
      const q = this.filterQuery || "";
      return '<div class="shop-wallet">'+
        '<div class="sw-item"><div class="sw-l">奖励点</div><div class="sw-v">'+p.points+'</div></div>'+
        '<div class="sw-item"><div class="sw-l">恐怖支线</div><div class="sw-v br">'+brTxt+'</div></div>'+
        '</div>'+
        '<div style="display:flex;gap:8px;margin-bottom:12px;">'+
          '<input type="text" id="shop-search" value="'+this._esc(q)+'" placeholder="检索兑换（名称/描述关键字）" '+
            'style="flex:1;margin:0;padding:10px 12px;font-size:14px;" '+
            'onkeydown="WK.SHOP._searchKey(event)" />'+
          '<button type="button" class="here-btn" style="padding:8px 14px;" onclick="WK.SHOP._searchGo()">搜索</button>'+
          (q ? '<button type="button" class="here-btn ghost" style="padding:8px 12px;" onclick="WK.SHOP.setFilter(&quot;&quot;)">清除</button>' : '')+
        '</div>'+
        '<button class="shop-repair" onclick="WK.SHOP.repair()">全身修复：清除 T 病毒感染、恢复满生命与体力（本集免费）</button>';
    },
    _searchKey(ev){
      if (ev && (ev.key === "Enter" || ev.keyCode === 13)) this._searchGo();
    },
    _searchGo(){
      const el = document.getElementById("shop-search");
      this.setFilter(el ? el.value : "");
    },
    setFilter(q){
      this.filterQuery = (q || "").trim();
      this.render();
      setTimeout(function(){
        const el = document.getElementById("shop-search");
        if (el) { el.focus(); el.selectionStart = el.selectionEnd = el.value.length; }
      }, 30);
    },
    _matchFilter(name, desc){
      const q = (this.filterQuery || "").toLowerCase();
      if (!q) return true;
      return ((name || "") + (desc || "")).toLowerCase().indexOf(q) >= 0;
    },
    /* 点击商品「详情」→ 弹窗显示数值 + 确认兑换（避免 onclick 嵌套引号） */
    showDetail(kind, key){
      let title = "兑换详情", body = "", buyBtn = "";
      const p = this.p();
      if (kind === "item") {
        let it = this.ITEMS.find(x => (x.id || x.skill) === key);
        if (!it && WK.CATALOG) {
          let c = null;
          ["tech", "magic", "aux", "fun"].forEach(function (ck) {
            if (c) return;
            const list = WK.CATALOG[ck] || [];
            for (let i = 0; i < list.length; i++) if (list[i].id === key) { c = list[i]; break; }
          });
          if (c) {
            it = {
              id: c.id, name: c.name, price: c.price != null ? c.price : (c.priceMul || 0),
              priceMul: c.priceMul, branch: c.branch, equip: !!c.equip, desc: c.desc,
              unique: !!c.infinite
            };
          }
        }
        if (!it) { WK.toast("条目不存在", "bad"); return; }
        const name = it.name || (WK.SKILL_DEF[it.skill] && WK.SKILL_DEF[it.skill].name) || it.id;
        const desc = it.desc || (WK.SKILL_DEF[it.skill] && WK.SKILL_DEF[it.skill].desc) || "";
        const def = it.id && WK.ITEM_DEF[it.id];
        let nums = "";
        if (def && def.stats) {
          const st = def.stats, bits = [];
          if (st.dmgMin != null) bits.push("伤害区间 " + st.dmgMin + "–" + st.dmgMax);
          else if (st.atk) bits.push("攻击 +" + st.atk);
          if (st.hit) bits.push("命中 +" + Math.round(st.hit * 100) + "%");
          if (st.crit) bits.push("暴击 +" + Math.round(st.crit * 100) + "%");
          if (st.armor) bits.push("护甲 +" + st.armor);
          if (st.maxHp) bits.push("生命上限 +" + st.maxHp);
          if (def.wepType) bits.push("类型 " + ({ ranged: "远程枪械", melee: "近战", bow: "弓" }[def.wepType] || def.wepType));
          if (bits.length) {
            nums = '<div style="margin:10px 0;padding:10px;border:1px solid var(--line2);border-radius:8px;background:var(--panel2);font-size:13px;color:var(--gold);line-height:1.7;">' +
              bits.join("<br>") + "</div>";
          }
        }
        title = name;
        // 豆包v165：详情同样把支线剧情摆到明面上，且点数/支线不足时确认按钮置灰
        const brTxt = it.branch ? (' + <b style="color:var(--gold);">支线 ' + this._fmtBranch(it.branch) + "</b>") : "";
        const detailDis = (p.points < it.price) || this._branchLack(it.branch);
        body = '<div style="font-size:13px;color:var(--dim);margin-bottom:6px;">价格 <b style="color:var(--god);font-size:18px;">' + it.price +
          '</b> 奖励点' + brTxt + '</div>' + nums +
          '<div style="font-size:14px;line-height:1.85;color:var(--txt);">' + this._esc(desc) + "</div>" +
          (it.equip ? '<div style="font-size:12px;color:var(--dim2);margin-top:10px;">购入后请在「人物 → 装备」装上（空槽会自动装备）。</div>' : "") +
          (def && def.kind === "ammo" ? '<div style="font-size:12px;color:var(--cyan);margin-top:10px;">弹药类：持有即对全体对应武器生效，无需装备槽。</div>' : "");
        if (it.skill) {
          if (this.ownedSkill(it.skill)) buyBtn = '<div class="sc-owned" style="text-align:center;padding:12px;">已拥有</div>';
          else buyBtn = '<button type="button" class="here-btn primary" style="width:100%;padding:12px;" data-buy-skill="' +
            it.skill + '" data-price="' + it.price + '" onclick="WK.SHOP._detailBuySkill(this)">确认兑换 · ' + it.price + " 点</button>";
        } else if (it.id) {
          if (it.unique && this.itemCount(it.id) > 0) buyBtn = '<div class="sc-owned" style="text-align:center;padding:12px;">已拥有</div>';
          else buyBtn = '<button type="button" class="here-btn primary" style="width:100%;padding:12px;" data-buy-item="' +
            it.id + '" data-price="' + it.price + '" onclick="WK.SHOP._detailBuyItem(this)"' + (detailDis ? " disabled" : "") +
            ">确认兑换 · " + it.price + " 点" + (it.branch ? (" + 支线 " + this._fmtBranch(it.branch)) : "") + "</button>";
        }
      } else if (kind === "blood") {
        const b = this.BLOODLINES.find(x => x.id === key);
        if (!b) return;
        title = b.name;
        body = '<div style="font-size:13px;color:var(--dim);margin-bottom:6px;">价格 <b style="color:var(--god);font-size:18px;">' + b.price +
          "</b> 点" + (b.branch ? (' + <b style="color:var(--gold);">' + b.branch + " 支线×1</b>") : "") + "</div>" +
          '<div style="font-size:14px;line-height:1.85;">' + this._esc(b.desc) + "</div>";
        if (this.ownedBlood(key) && key === "base_blood") buyBtn = '<div class="sc-owned" style="text-align:center;padding:12px;">已拥有</div>';
        else buyBtn = '<button type="button" class="here-btn primary" style="width:100%;padding:12px;" data-buy-blood="' +
          key + '" onclick="WK.SHOP._detailBuyBlood(this)">确认兑换</button>';
      }
      WK.ui.generic(title, body + '<div style="margin-top:14px;">' + buyBtn +
        '<button type="button" class="here-btn ghost" style="width:100%;margin-top:8px;padding:10px;" onclick="WK.ui.closeOverlay(&quot;ov-generic&quot;)">关闭</button></div>');
    },
    _detailBuySkill(btn){
      WK.ui.closeOverlay("ov-generic");
      this.buySkill(btn.getAttribute("data-buy-skill"), parseInt(btn.getAttribute("data-price"), 10));
    },
    _detailBuyItem(btn){
      WK.ui.closeOverlay("ov-generic");
      this.buyItem(btn.getAttribute("data-buy-item"), parseInt(btn.getAttribute("data-price"), 10));
    },
    _detailBuyBlood(btn){
      WK.ui.closeOverlay("ov-generic");
      this.buyBlood(btn.getAttribute("data-buy-blood"));
    },

    render(){
      const t=this.tab; let html=this.walletHtml();
      if(t==="tech"||t==="magic"||t==="aux"||t==="fun") html+=this._renderItems(t);
      else html+=this._renderOther();
      document.getElementById("shop-body").innerHTML=html;
    },

    _esc(s){ return WK.EVT && WK.EVT._esc ? WK.EVT._esc(s) : String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;"); },

    _renderAttrs(){
      const p=this.p();
      let h='<div class="shop-sect-t">六维属性强化（普通人均值 100 · 10 奖励点 = 1 点身体素质）</div>';
      this.ATTRS.forEach(a=>{
        const v=p.attrs[a.k]||100;
        h+='<div class="attr-row"><div class="ar-n">'+a.name+'<small>'+a.sub+'</small></div>'+
          '<div class="ar-v">'+v+'</div><div class="ar-bs">'+
          '<button onclick="WK.SHOP.buyAttr(\''+a.k+'\',1)" '+(p.points<10?"disabled":"")+'>+1 · 10点</button>'+
          '<button onclick="WK.SHOP.buyAttr(\''+a.k+'\',10)" '+(p.points<100?"disabled":"")+'>+10 · 100点</button>'+
          '</div></div>';
      });
      h+='<div class="shop-note">神经反应影响命中/集气/闪避；肌肉影响物理伤害；细胞活力关联生命；免疫力降低感染与病变风险。属性无硬上限，请按后续副本需要规划。</div>';
      return h;
    },

    _card(ic,type,name,desc,priceHtml,actionHtml,extraCls,detailKey,nameRaw){
      // detailKey: "item:eq_glock" / "blood:base_blood"
      // nameRaw=true 时 name 视为已构造好的安全 HTML（基础名已自行 _esc），不再整体转义（豆包v173：能量标签 span）
      let click = "";
      if (detailKey) {
        const parts = String(detailKey).split(":");
        const k0 = parts[0] || "", k1 = parts[1] || "";
        click = ' style="cursor:pointer;" data-dk0="' + k0 + '" data-dk1="' + k1 +
          '" onclick="WK.SHOP.showDetail(this.getAttribute(&quot;data-dk0&quot;),this.getAttribute(&quot;data-dk1&quot;))" title="查看详情"';
      }
      const typeLabel = WK.SKILL_META[type]
        ? WK.SKILL_META[type].label
        : (type === "base" ? "基础" : type === "fun" ? "娱乐" : type === "martial" ? "近战" : type);
      return '<div class="shop-card ' + (extraCls || "") + '">' +
        '<div class="sc-ico">' + ic + "</div>" +
        "<div class=\"sc-main\"" + click + "><div class=\"sc-n\">" + (nameRaw ? name : this._esc(name)) +
        (type ? '<span class="sc-tag t-' + type + '">' + typeLabel + "</span>" : "") +
        (detailKey ? '<span style="font-size:10px;color:var(--cyan);margin-left:6px;">详情</span>' : "") +
        '</div><div class="sc-d">' + this._esc(desc) + "</div></div>" +
        '<div class="sc-buy">' + priceHtml + actionHtml + "</div></div>";
    },

    /* 豆包v172：辅助类「非血统 / 血统」子筛选切换 */
    setAuxFilter(k){ this._auxFilter = k; this.filterQuery = ""; if (this._refresh) this._refresh(); else this.render(); },
    /* 豆包v178：科技 / 传说魔法页子筛选切换（清空文本检索，计数展示） */
    setSubFilter(k){
      this._subFilter = this._subFilter || {};
      this._subFilter[this.tab] = k;
      this.filterQuery = "";
      if (this._refresh) this._refresh(); else this.render();
    },
    SUB_DEFS: {
      tech:  [["all","全部"],["melee","近战"],["ranged","远程·枪械"],["armor","防具"],["acc","饰品"],["ammo","弹药"],["throw","投掷"],["heal","医疗"],["other","其他"]],
      magic: [["all","全部"],["melee","近战·法器"],["ranged","远程"],["armor","防具"],["acc","饰品·护符"],["scroll","卷轴·法术"],["potion","丹药·药水"],["ammo","胶卷·弹药"],["throw","投掷"],["other","其他"]]
    },
    /* 单条兑换 → 子筛选桶。优先 ITEM_DEF 落库后的最终字段（v169 magicFinish 已修正 kind/wepType），无则退回目录原字段。 */
    _subCat(x, tab){
      const d = (WK.ITEM_DEF && WK.ITEM_DEF[x.id]) || null;
      const c = d || x;
      const k = c.kind, ki = c.kind_item, wt = c.wepType, sl = c.slot;
      const n = (x.name || c.name || "") + " " + (x.desc || c.desc || "");
      const t = x.type || c.type;
      if (k === "weapon" || k === "melee" || k === "gun" || sl === "weapon" || wt || t === "firearm") {
        if (wt === "ranged" || wt === "bow" || k === "gun" || t === "firearm" || /射影机|相机|枪|炮|弩/.test(n)) return "ranged";
        return "melee";
      }
      if (k === "armor" || sl === "armor") return "armor";
      if (sl === "accessory" || sl === "ring" || k === "equip" || k === "charm" || k === "shield") return "acc";
      if (k === "scroll" || (d && d.magicScroll)) return "scroll";
      if (k === "ammo" || k === "ammo_ench" || k === "arrow" || k === "ammo_arrow" || ki === "ammo" || ki === "film" || k === "film") return "ammo";
      if (k === "throw" || ki === "throw") return "throw";
      if (k === "heal" || ki === "heal" || (c.stats && c.stats.heal != null)) return (tab === "magic") ? "potion" : "heal";
      if (tab === "magic" && (k === "consumable" || ki === "consumable")) return "potion";
      return "other";
    },
    _renderItems(tab){
      const p=this.p();
      const TITLE={ tech:"科技类（全量 · 可检索）", magic:"传说魔法类（全量 · 可检索）", aux:"辅助类（非血统技能/道具 · 血统模板 · 可检索）", fun:"娱乐类（可检索）" };
      let h='<div class="shop-sect-t">'+TITLE[tab]+'</div>';
      // 豆包v172：辅助类拆「非血统（技能/道具）/ 血统（模板）」两个子筛选，默认非血统
      if (tab === "aux") {
        const f = this._auxFilter || "nonblood";
        const seg = (k, label) => '<button onclick="WK.SHOP.setAuxFilter(\''+k+'\')" style="flex:1;padding:9px;border-radius:9px;border:1px solid var(--line);cursor:pointer;font-size:12.5px;' +
          (f===k ? 'background:var(--gold);color:#1a170f;border-color:var(--gold);font-weight:700;' : 'background:transparent;color:var(--dim2);') + '">'+label+'</button>';
        h += '<div style="display:flex;gap:8px;margin:2px 0 12px;">' + seg("nonblood","非血统 · 技能 / 道具") + seg("blood","血统 · 模板") + '</div>';
      }
      // 豆包v178：科技 / 传说魔法页子筛选（近战/远程/防具/饰品/弹药/投掷/医疗/卷轴…），与文本检索叠加、带计数
      if (tab === "tech" || tab === "magic") {
        const f = (this._subFilter || {})[tab] || "all";
        const defs = this.SUB_DEFS[tab] || this.SUB_DEFS.tech;
        const fromItems2 = this.ITEMS.filter(function (x) { return x.tab === tab && x.skill; });
        const countSrc = (WK.CATALOG && WK.CATALOG[tab]) || [];
        const counts = {};
        countSrc.concat(fromItems2).forEach(function (x) { const c = WK.SHOP._subCat(x, tab); counts[c] = (counts[c] || 0) + 1; });
        const allCnt = countSrc.length + fromItems2.length;
        const seg2 = (k, label) => '<button onclick="WK.SHOP.setSubFilter(\''+k+'\')" style="flex:0 0 auto;padding:7px 11px;border-radius:9px;border:1px solid var(--line);cursor:pointer;font-size:12px;' +
          (f===k ? 'background:var(--gold);color:#1a170f;border-color:var(--gold);font-weight:700;' : 'background:transparent;color:var(--dim2);') + '">'+label+
          ' <span style="opacity:.65;font-size:10.5px;">'+(k==="all"?allCnt:(counts[k]||0))+'</span></button>';
        h += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin:2px 0 12px;">' + defs.map(d=>seg2(d[0],d[1])).join("") + '</div>';
      }
      let list;
      if ((tab === "tech" || tab === "magic" || tab === "aux" || tab === "fun") && WK.CATALOG && WK.CATALOG[tab] && WK.CATALOG[tab].length) {
        // 全量科技类目录（原著价）+ 本集技能类 ITEMS
        const fromCat = WK.CATALOG[tab].map(function (c) {
          return {
            tab: "tech",
            icon: (c.name && c.name[0]) || "科",
            type: c.type || (c.kind === "melee" || c.kind === "weapon" ? "martial" : c.kind === "gun" ? "firearm" : c.kind === "scroll" ? "magic" : "base"),
            id: c.id,
            skill: null,
            price: c.price != null ? c.price : (c.priceMul || 0),
            priceMul: c.priceMul,
            branch: c.branch,
            equip: !!c.equip,
            unique: !!c.infinite,
            consumable: !c.equip && (c.kind === "ammo" || c.kind === "ammo_ench" || c.kind === "throw" || c.kind === "ammo_arrow"),
            name: c.name,
            desc: (c.priceMul ? ("【倍率弹药 ×" + c.priceMul + "】") : "") +
              (c.branch ? ("【需支线 " + (WK.SHOP._fmtBranch ? WK.SHOP._fmtBranch(c.branch) : String(c.branch)) + "】") : "") +
              (c.req ? ("【前置：" + c.req + "】") : "") +
              (c.desc || "") +
              (c.stats && c.stats.dmgMin != null ? (" 数值：伤害 " + c.stats.dmgMin + "–" + c.stats.dmgMax +
                " 命中+" + Math.round((c.stats.hit || 0) * 100) + "% 暴击+" + Math.round((c.stats.crit || 0) * 100) + "%") : "") +
              (c.stats && c.stats.atk != null && (c.wepType === "melee" || c.kind === "weapon") ? (" 数值：近战攻击+" + c.stats.atk) : "") +
              (c.stats && c.stats.armor != null ? (" 数值：护甲+" + c.stats.armor) : "") +
              (c.stats && c.stats.shield != null ? (" 护盾+" + c.stats.shield) : "") +
              (c.stats && c.stats.carryBonus != null ? (" 容量+" + c.stats.carryBonus + "格") : "") +
              (c.stats && c.stats.scrollDmg != null ? (" 数值：卷轴威力约 " + c.stats.scrollDmg) : "") +
              (c.stats && c.stats.heal != null ? (" 数值：回复生命 " + c.stats.heal + (c.stats.cdSec ? (" · CD" + c.stats.cdSec + "秒") : "")) : "") +
              (c.stats && c.stats.energy != null ? (" 能量 " + c.stats.energy) : "") +
              (c.stats && c.stats.revive ? (" 数值：复活（生命约 " + (c.stats.reviveHpPct || 20) + "%）") : "") +
              (c.stats && c.stats.buff && c.stats.durationSec != null ? (" 数值：持续 " + c.stats.durationSec + " 秒") : "") +
              (c.stats && c.stats.dmgMin != null && c.kind_item === "damage" ? (" 数值：伤害 " + c.stats.dmgMin + "–" + c.stats.dmgMax) : "")
          };
        });
        const fromItems = this.ITEMS.filter(function (x) { return x.tab === tab && x.skill; });
        list = fromItems.concat(fromCat).filter(function (x) {
          // 时间回归类改在「其他」操作，娱乐类列表隐藏以免重复
          if (tab === "fun" && (x.kind === "meta_time" || (x.name && /回归|开启恐怖片/.test(x.name)))) return false;
          const name = x.name || x.id;
          const desc = x.desc || "";
          return WK.SHOP._matchFilter(name, desc);
        });
      } else {
        list = this.ITEMS.filter(x => {
          if (x.tab !== tab) return false;
          const name = x.name || (WK.SKILL_DEF[x.skill] && WK.SKILL_DEF[x.skill].name) || x.id;
          const desc = x.desc || (WK.SKILL_DEF[x.skill] && WK.SKILL_DEF[x.skill].desc) || "";
          return this._matchFilter(name, desc);
        });
      }
      // 豆包v172：辅助类按子筛选隐藏另一块（血统模板 / 非血统技能道具）
      if (tab === "aux") {
        const f = this._auxFilter || "nonblood";
        list = list.filter(function (x) {
          const d = WK.ITEM_DEF[x.id];
          const isBl = !!(d && d._auxBloodline);
          return f === "blood" ? isBl : !isBl;
        });
      }
      // 豆包v178：科技/魔法页子筛选过滤（与文本检索叠加；计数用全量、列表用筛后）
      if (tab === "tech" || tab === "magic") {
        const f = (this._subFilter || {})[tab];
        if (f && f !== "all") list = list.filter(function (x) { return WK.SHOP._subCat(x, tab) === f; });
      }
      if(!list.length) h+='<div class="shop-note">'+(this.filterQuery?"没有匹配「"+this._esc(this.filterQuery)+"」的条目。":"本类兑换表待导入。")+'</div>';
      // v157：大表分页，避免 1000+ 条卡死导致「点了 Tab 没反应」
      const PAGE = 40;
      const totalAll = list.length;
      if (!this.filterQuery && totalAll > PAGE) {
        h += '<div class="shop-note">共 '+totalAll+' 条。未搜索时仅显示前 '+PAGE+' 条，请用上方检索缩小范围。</div>';
        list = list.slice(0, PAGE);
      } else if (this.filterQuery && totalAll > 80) {
        h += '<div class="shop-note">匹配 '+totalAll+' 条，显示前 80 条。</div>';
        list = list.slice(0, 80);
      }
      list.forEach(it=>{
        const name=it.name || (WK.SKILL_DEF[it.skill]&&WK.SKILL_DEF[it.skill].name) || it.id;
        const desc=it.desc || (WK.SKILL_DEF[it.skill]&&WK.SKILL_DEF[it.skill].desc) || "";
        // 豆包v165：价格同时标明「奖励点 + 支线剧情」；点数或支线任一不足即置灰
        const brTag = it.branch ? (' <b style="color:var(--gold);font-weight:700;">+支线 '+this._fmtBranch(it.branch)+'</b>') : "";
        const price='<div class="sc-price">'+it.price+' <small>点</small>'+brTag+'</div>';
        const dis = (p.points < it.price) || this._branchLack(it.branch);
        const dkey="item:"+(it.id||it.skill);
        const idef = WK.ITEM_DEF[it.id];
        const isAuxSkill = idef && idef.bind === "skill" && idef.skillId && WK.SKILL_DEF[idef.skillId];
        // 豆包v173：血统 / 模板卡——结构化展示能量体系 / 六维 / 特质 / 授予技能 / 前置
        const isBloodCard = idef && idef._auxBloodline;
        if (isBloodCard && WK.Blood) {
          const pv = WK.Blood.preview(it);
          const AM = { mus:"肌肉", ner:"神经", int:"智力", spi:"精神", cel:"细胞", imm:"免疫" };
          const chip = (txt, color) => '<span style="display:inline-block;font-size:10.5px;padding:1px 7px;margin:2px 4px 0 0;border-radius:8px;border:1px solid '+color+'55;color:'+color+';background:'+color+'18;">'+txt+'</span>';
          const chips = [];
          if (pv.energyName) chips.push(chip(pv.physical ? ("◈ " + pv.energyName + " · 技能耗体力") : ("◈ " + pv.energyName + "池 " + Math.round(pv.energyCap)), "#d88a9a"));
          const ap = Object.keys(AM).map(k => pv.attrs[k] ? (AM[k] + "+" + pv.attrs[k]) : null).filter(Boolean);
          if (ap.length) chips.push(chip("六维 " + ap.join(" "), "#c8b07a"));
          if (pv.traits.length) chips.push(chip("特质 " + pv.traits.map(x => WK.Blood.TRAIT_LABEL[x] || x).join("·"), "#8fd0a0"));
          let sn = pv.generic
            ? (pv.sigNames || [])
            : pv.skillIds.map(sid => WK.SKILL_DEF[sid] ? WK.SKILL_DEF[sid].name : null).filter(Boolean);
          sn = sn.filter((v,i)=>sn.indexOf(v)===i);
          if (sn.length) chips.push(chip("授技 " + sn.join("、"), "#9ab8e0"));
          if (pv.lineLabel) chips.push(chip(pv.lineLabel + (pv.tier ? "·" + pv.tier : ""), "#b0a0d0"));
          // 豆包v175：特质量化效果明细（只展示有真实机制/数值的特质，按出现顺序去重）
          const _seenT = [];
          const tLines = pv.traits.filter(t => {
            const d = WK.Blood.TRAIT_DESC[t];
            if (!d || _seenT.indexOf(t) >= 0) return false;
            _seenT.push(t); return true;
          }).map(t => '<div style="font-size:10.5px;line-height:1.5;color:#a7d8bb;margin-top:3px;">· '
            + (WK.Blood.TRAIT_LABEL[t] || t) + '：<span style="color:#8fc7a6;">' + WK.Blood.TRAIT_DESC[t] + '</span></div>').join("");
          const traitDetail = tLines ? ('<div style="margin-top:3px;padding:5px 8px;border-left:2px solid #6fae8555;background:#3a7a5214;border-radius:0 6px 6px 0;">'+tLines+'</div>') : "";
          const ownedBl = WK.Blood.hasName(it.name);
          const reqOk = !pv.req || WK.Blood.hasReq(pv.req);
          const reqHtml = pv.req ? ('<div style="font-size:10.5px;margin-top:4px;color:'+(reqOk?"#7fc89a":"#d0907a")+';">前置：'+this._esc(pv.req)+(reqOk?"（已满足）":"（未满足）")+'</div>') : "";
          h += '<div class="shop-card'+(ownedBl?" owned":"")+'"><div class="sc-ico">血</div><div class="sc-main">'+
            '<div class="sc-n">'+this._esc(name)+'<span class="sc-tag" style="background:#5a2a3a;color:#f0c8d4;">血统</span></div>'+
            '<div style="margin-top:2px;">'+chips.join("")+'</div>'+traitDetail+
            '<div class="sc-d" style="margin-top:4px;">'+this._esc(desc)+'</div>'+reqHtml+'</div>'+
            '<div class="sc-buy">'+(ownedBl
              ? '<div class="sc-owned">已拥有 ✓</div>'
              : price+'<button class="sc-btn" onclick="WK.SHOP.buyItem(\''+it.id+'\','+it.price+')" '+((dis||!reqOk)?"disabled":"")+'>兑换血统</button>')+'</div></div>';
        } else {
        const isAuxPool = idef && idef.bind === "pool";
        if(isAuxPool){
          // 豆包v173：能量池强化卡（气功开内力等）
          const pmeta = (WK.Blood && WK.Blood.POOL_META[idef.poolKey]) || {name:"能量"};
          const curMax = (WK.Blood && WK.Blood.ensurePools(p)[idef.poolKey] || {}).max || 0;
          const reached = curMax >= idef.poolMax;
          const nm2 = this._esc(name) + ' <span style="color:#7fb8d8;font-size:10.5px;white-space:nowrap;">'+pmeta.name+'池 · 上限'+idef.poolMax+'</span>';
          if (reached) h += this._card((name[0]||"气"), "aux", nm2, desc, "", '<div class="sc-owned">已达此境界 ✓</div>', "owned", "item:"+it.id, true);
          else h += this._card((name[0]||"气"), "aux", nm2, desc, price,
            '<button class="sc-btn" onclick="event.stopPropagation();WK.SHOP.buyItem(\''+it.id+'\','+it.price+')" '+(dis?"disabled":"")+'>'+(curMax>0?'提升':'开辟')+'</button>', "", "item:"+it.id, true);
        } else if(isAuxSkill){
          // 豆包v172：辅助类技能卡（学到写入 p.skills）。未开对应能量体系的标「需XX」，仍可先学
          const sd = WK.SKILL_DEF[idef.skillId];
          const owned = !!(p.skills && p.skills[idef.skillId]);
          // 豆包v173：能量标签动态化——玩家已开辟对应能量池则显示「可施展」，否则提示需先获得该能量
          const __rk = sd.res;
          const __has = !__rk || __rk === "stamina" || (WK.Blood && WK.Blood.hasEnergyType(__rk, p));
          let __tag = "";
          if (!__has) __tag = ' <span style="color:#c98a5b;font-size:10.5px;white-space:nowrap;">需'+(idef.energyLabel||"能量")+"</span>";
          else if (__rk && __rk !== "stamina") __tag = ' <span style="color:#7fc89a;font-size:10.5px;white-space:nowrap;">'+(WK.SKILL_META[sd.type]?WK.SKILL_META[sd.type].label:"")+'可施展</span>';
          const nm2 = this._esc(name) + __tag;
          if (owned) h += this._card((name[0]||"技"), sd.type, nm2, desc, "", '<div class="sc-owned">已掌握 ✓</div>', "owned", "item:"+it.id, true);
          else h += this._card((name[0]||"技"), sd.type, nm2, desc, price,
            '<button class="sc-btn" onclick="event.stopPropagation();WK.SHOP.buyItem(\''+it.id+'\','+it.price+')" '+(dis?"disabled":"")+'>学习</button>', "", "item:"+it.id, true);
        } else if(it.skill){
          if(this.ownedSkill(it.skill)){
            h+=this._card(it.icon,it.type,name,desc,"",'<div class="sc-owned">已拥有 ✓</div>',"owned","item:"+(it.id||it.skill));
          }else{
            h+=this._card(it.icon,it.type,name,desc,price,
              '<button class="sc-btn" onclick="event.stopPropagation();WK.SHOP.buySkill(\''+it.skill+'\','+it.price+')" '+(dis?"disabled":"")+'>兑换</button>',"",dkey);
          }
        }else if(it.consumable){
          const n=this.itemCount(it.id);
          h+=this._card(it.icon,it.type,name+(n?(" · 持有 "+n):""),desc,price,
            '<button class="sc-btn" onclick="WK.SHOP.buyItem(\''+it.id+'\','+it.price+')" '+(dis?"disabled":"")+'>购入</button>'+
            (n?'<button class="sc-btn ghost" onclick="WK.SHOP.useItem(\''+it.id+'\')">使用</button>':""), "", dkey);
        }else if(it.unique || it.equip){
          const owned=this.itemCount(it.id)>0;
          h+=this._card(it.icon,it.type,name,desc,owned?"":price,
            owned ? '<div class="sc-owned">已拥有 ✓</div>'
                  : '<button class="sc-btn" onclick="WK.SHOP.buyItem(\''+it.id+'\','+it.price+')" '+(dis?"disabled":"")+'>兑换</button>', owned?"owned":"", dkey);
        }else{
          h+=this._card(it.icon,it.type,name,desc,price,
            '<button class="sc-btn" onclick="WK.SHOP.buyItem(\''+it.id+'\','+it.price+')" '+(dis?"disabled":"")+'>兑换</button>', "", dkey);
        }
        } // 豆包v173：闭合血统卡分支的外层 else
      });
      // 豆包v167：旧的「高阶锁定预览」占位卡（气功/重装机甲/回归现实天数，竖排布局错乱）
      // 已整段删除——大表（CATALOG）导入后这些条目由正式兑换表提供；时间回归在「其他」页操作。
      return h;
    },

    /* —— 豆包v142：第五页·血统兑换（BLOODLINES 待大表填入；购买逻辑 buyBlood 已备好）—— */
    _renderBlood(){
      let h='<div class="shop-sect-t">血统兑换（兑换后获得跨世界的种族 / 血脉天赋，通常需要奖励点 + 支线剧情）</div>';
      if(!this.BLOODLINES.length){
        h+='<div class="shop-note">血统兑换表尚未导入。<br>框架与资源（奖励点 + S/A/B/C/D 支线剧情）已就绪，拿到兑换大表后会在此列出各阶血统与其强化、兑换条件。</div>';
        return h;
      }
      const p=this.p();
      this.BLOODLINES.forEach(b=>{
        const owned=this.ownedBlood(b.id), dis=p.points<b.price || (b.branch && (p.branch[b.branch]||0)<1);
        const price='<div class="sc-price">'+b.price+' <small>点</small>'+(b.branch?' + <b>'+b.branch+' 支线×1</b>':"")+'</div>';
        h+=this._card("血","blood",b.name,b.desc,price,
          owned?'<div class="sc-owned">已兑换 ✓</div>'
                :'<button class="sc-btn" onclick="WK.SHOP.buyBlood(\''+b.id+'\')" '+(dis?"disabled":"")+'>兑换血统</button>',
          owned?"owned":"","blood:"+b.id);
      });
      return h;
    },
    ownedBlood(id){
      const p=this.p();
      if (p.bloodlines && p.bloodlines[id]) return true;
      if (id==="base_blood" && p.bloodline) return true;
      if (p.bloodline && p.bloodline.bought && p.bloodline.bought[id]) return true;
      return false;
    },
    buyBlood(id){
      // 豆包v164【P4 加固】旧「独立血统页」入口已废弃——血统已并入「辅助类」，统一走
      // WK.Blood.buyFromShop（写 p.bloodlines.slots[]）。这里仅为兼容任何残留按钮/事件委托而保留，
      // 一律转发到新系统；绝不再用旧的对象式 p.bloodlines[id]={...} 双写（会冲掉新系统的 slots 数组）。
      if(!id) return;
      let cat=null;
      if(WK.CATALOG){
        outer: for(const ck of ["aux","tech","magic","fun"]){
          for(const x of (WK.CATALOG[ck]||[])){ if(x.id===id){ cat=x; break outer; } }
        }
      }
      if(!cat && WK.BLOOD_DB && WK.BLOOD_DB[id]) cat=Object.assign({id:id}, WK.BLOOD_DB[id]);
      if(!cat){ WK.toast("该血统请在主神「辅助类」中检索兑换","bad"); return; }
      if(WK.Blood && WK.Blood.buyFromShop) WK.Blood.buyFromShop(cat);
    },

    /* —— 豆包v139 N20：贵重品回收页。把恐怖片里搜刮到的贵重品（kind:"valuable"）兑成奖励点 —— */
    _valuableIds(){
      return Object.keys(WK.ITEM_DEF).filter(id=>WK.ITEM_DEF[id].kind==="valuable");
    },
    /* 豆包v142：本世界「特殊素材」终身一次性兑换（奖励点 + 支线剧情）。
       普通贵重品（val_*）走 sellValuable 反复回收；这三件是战略级素材，每件存档内仅可兑换一次。 */
    SPECIAL:[
      { id:"tvirus",       pts:1000, branch:"D", name:"T 病毒原液",   note:"赌命撞「弱化一阶基因锁」之外的另一条路——上交给主神解析。" },
      { id:"antiviral",    pts:1000, branch:"D", name:"抗病毒血清",   note:"完整的 T 病毒解法样本，主神同样愿意出高价与一支线。" },
      { id:"core_redqueen",pts:500,  branch:"C", name:"红后核心存储器", note:"蜂房 AI 的底层核心，密钥与全套 BOW 数据都在里面，规格高于普通情报。" }
    ],

    /* 「其他」页里的「本世界素材回收」整段（贵重品 + 特殊素材）*/
    _renderSell(){
      let h='<div class="shop-sect-t">本世界素材回收（贵重品折点；特殊素材给点 + 支线）</div>';
      const owned=this._valuableIds().filter(id=>WK.inv.count(id)>0);
      if(owned.length){
        owned.forEach(id=>{
          const d=WK.ITEM_DEF[id], n=WK.inv.count(id);
          h+=this._card("金","base",d.name+" · 持有 "+n,d.desc,
            '<div class="sc-price">'+d.value+' <small>点/件</small></div>',
            '<button class="sc-btn primary" onclick="WK.SHOP.sellValuable(\''+id+'\')">回收 ×1</button>');
        });
      }
      // 特殊素材（持有才显示；已兑换的置灰）
      let anySpec=false;
      this.SPECIAL.forEach(s=>{
        const n=WK.inv.count(s.id), done=!!this.p().redeemed[s.id];
        if(n<=0 && !done) return;
        anySpec=true;
        const d=WK.ITEM_DEF[s.id];
        const price='<div class="sc-price">'+s.pts+' <small>点</small> + <b>'+s.branch+' 支线×1</b></div>';
        const btn = done ? '<div class="sc-owned">已兑换 ✓</div>'
          : '<button class="sc-btn primary" onclick="WK.SHOP.redeemMaterial(\''+s.id+'\')">兑换（持有 '+n+'）</button>';
        h+=this._card("核","base",s.name,(d?d.desc:"")+" "+s.note,price,btn,done?"owned":"");
      });
      if(!owned.length && !anySpec){
        h+='<div class="shop-note">你身上还没有可回收的东西。<br>蜂房里能翻出现实世界值钱的贵重品（名表 / 首饰 / 机密硬盘）；深层还能拿到 T 病毒原液、抗病毒血清与红后核心这类战略素材——它们不占格、可跨世界带回这里兑换。</div>';
      }
      return h;
    },
    sellValuable(id){
      const d=WK.ITEM_DEF[id];
      if(!d||d.kind!=="valuable"||!WK.inv.count(id)){ WK.toast("没有这件贵重品","bad"); return; }
      WK.inv.remove(id,1);
      WK.rules.addPoints(d.value, "主神回收 · "+d.name);
      WK.toast(d.name+" 回收 +"+d.value+" 点","gold");
      this._refresh();
    },
    /* 特殊素材一次性兑换：扣素材 → 加奖励点 → 加支线剧情 → 记 redeemed（终身一次）*/
    redeemMaterial(id){
      const p=this.p();
      const s=this.SPECIAL.find(x=>x.id===id); if(!s) return;
      if(p.redeemed[id]){ WK.toast("这件素材已经兑换过了","bad"); return; }
      if(WK.inv.count(id)<=0){ WK.toast("没有这件素材","bad"); return; }
      WK.inv.remove(id,1);
      p.redeemed[id]=true;
      WK.rules.addPoints(s.pts, "主神回收 · "+s.name);
      p.branch[s.branch]=(p.branch[s.branch]||0)+1;
      WK.save.write();
      WK.log("reward","【素材回收】"+s.name+" → "+s.pts+" 奖励点 + 1 个 "+s.branch+" 级恐怖支线剧情（终身仅一次）。");
      WK.toast(s.name+" 兑换：+"+s.pts+" 点，+"+s.branch+" 级支线×1","gold");
      this._refresh();
    },

    /* —— 豆包v142：第六页「其他」：属性强化 / 素材回收 / 主神造人 / 队长权限项 —— */
    _renderOther(){
      let h = this._renderAttrs();
      h += this._renderBranchExchange();
      h += this._renderTimeExchange();
      h += this._renderSell();
      h += '<div class="shop-sect-t" style="margin-top:18px;">主神造人</div>';
      h += WK.CREATED.panelHtml();
      return h;
    },
    /* 时间/回归兑换（原著娱乐类条目，挂在「其他」便于操作）
       · 开启恐怖片：D 支线，解锁「回归已开启的恐怖片」
       · 回归上一场：10 点/天（本集按天数购买）
       · 回归已开启：50 点/天，需已开启恐怖片
       · 回归现实：50000 点 */
    _renderTimeExchange(){
      const p = this.p();
      const f = p.flags || {};
      const opened = !!f.horrorWorldOpened;
      const brD = (p.branch && p.branch.D) || 0;
      const pts = p.points || 0;

      function card(title, desc, priceHtml, btnHtml, extraCls){
        return '<div class="shop-card ' + (extraCls || "") + '" style="margin:8px 0;">' +
          '<div class="sc-ico">时</div>' +
          '<div class="sc-main"><div class="sc-n">' + title + '</div>' +
          '<div class="sc-d">' + desc + '</div></div>' +
          '<div class="sc-buy">' + priceHtml + btnHtml + "</div></div>";
      }

      let h = '<div class="shop-sect-t" style="margin-top:18px;">时间与回归</div>';
      h += '<div style="font-size:12px;color:var(--dim);line-height:1.7;margin-bottom:10px;">' +
        "原著设定：先用支线「开启」曾经历过的恐怖片世界，才能按天回归停留；回归上一场无需开启；彻底回归现实需大量奖励点。" +
        "<br>当前：开启状态 <b style=\"color:" + (opened ? "var(--gold)" : "var(--dim)") + "\">" +
        (opened ? "已开启" : "未开启") + "</b> · D 支线 " + brD + " · 奖励点 " + pts +
        "</div>";

      // 1 开启恐怖片
      if (opened) {
        h += card("开启恐怖片", "已解锁：可兑换「回归已开启的恐怖片」（50点/天）。",
          '<div class="sc-price"><small>已拥有</small></div>',
          '<div class="sc-owned" style="text-align:center;padding:8px;">已开启</div>');
      } else {
        h += card("开启恐怖片",
          "消耗 <b>D 支线×1</b>。让你可以回归经历过的指定恐怖片世界（之后才能买「回归已开启的恐怖片」）。",
          '<div class="sc-price">D×1</div>',
          '<button type="button" class="sc-btn" ' + (brD < 1 ? "disabled " : "") +
          'onclick="WK.SHOP.buyOpenHorror()">开启</button>');
      }

      // 2 回归上一场（10/天）
      h += card("回归上一场恐怖片",
        "10 奖励点/天。可指定降落地点。无需「开启恐怖片」。购买时选择停留天数。",
        '<div class="sc-price">10点/天</div>',
        '<button type="button" class="sc-btn" ' + (pts < 10 ? "disabled " : "") +
        'onclick="WK.SHOP.buyReturnPrev()">购买天数</button>');

      // 3 回归已开启（50/天）— 前提：已开启
      if (!opened) {
        h += card("回归已开启的恐怖片",
          "50 奖励点/天。可指定降落地点。<b style=\"color:var(--bad)\">前提：须先兑换「开启恐怖片」。</b>",
          '<div class="sc-price">50点/天</div>',
          '<button type="button" class="sc-btn" disabled>需先开启</button>', "locked");
      } else {
        h += card("回归已开启的恐怖片",
          "50 奖励点/天。可指定降落地点（已满足开启前提）。",
          '<div class="sc-price">50点/天</div>',
          '<button type="button" class="sc-btn" ' + (pts < 50 ? "disabled " : "") +
          'onclick="WK.SHOP.buyReturnOpened()">购买天数</button>');
      }

      // 4 回归现实
      h += card("回归现实世界",
        "50000 奖励点。回到现实世界。兑换后，参加下一届恐怖片轮回时将使用已回归现实的人物卡。",
        '<div class="sc-price">50000点</div>',
        '<button type="button" class="sc-btn" ' + (pts < 50000 ? "disabled " : "") +
        'onclick="WK.SHOP.buyReturnReality()">彻底回归</button>');

      return h;
    },
    buyOpenHorror(){
      const p = this.p();
      if (!p.branch) p.branch = { S:0, A:0, B:0, C:0, D:0 };
      if ((p.branch.D || 0) < 1) { WK.toast("需要 D 支线×1", "bad"); return; }
      if (p.flags && p.flags.horrorWorldOpened) { WK.toast("已经开启过了", "good"); return; }
      p.branch.D -= 1;
      p.flags = p.flags || {};
      p.flags.horrorWorldOpened = true;
      WK.toast("已开启恐怖片世界通道（可购买回归已开启的恐怖片）", "gold");
      if (WK.save && WK.save.write) WK.save.write();
      this.render();
    },
    buyReturnPrev(){
      this._buyReturnDays(10, "回归上一场恐怖片", false);
    },
    buyReturnOpened(){
      const p = this.p();
      if (!(p.flags && p.flags.horrorWorldOpened)) {
        WK.toast("请先兑换「开启恐怖片」", "bad");
        return;
      }
      this._buyReturnDays(50, "回归已开启的恐怖片", true);
    },
    _buyReturnDays(pricePerDay, label, needOpened){
      const p = this.p();
      if (needOpened && !(p.flags && p.flags.horrorWorldOpened)) {
        WK.toast("请先兑换「开启恐怖片」", "bad");
        return;
      }
      const maxDays = Math.max(1, Math.floor((p.points || 0) / pricePerDay));
      if (maxDays < 1) { WK.toast("奖励点不足", "bad"); return; }
      const raw = window.prompt(label + "\n每 " + pricePerDay + " 点 = 1 天。\n可买 1–" + maxDays + " 天，请输入天数：", "1");
      if (raw == null) return;
      const days = parseInt(raw, 10);
      if (!(days >= 1) || days > maxDays) { WK.toast("天数无效", "bad"); return; }
      const cost = days * pricePerDay;
      if (!this._charge(cost, "主神兑换 · " + label + " ×" + days + "天")) return;
      p.flags = p.flags || {};
      p.flags.returnDays = (p.flags.returnDays || 0) + days;
      p.flags.lastReturnType = label;
      WK.toast("已兑换「" + label + "」" + days + " 天（主神已记录；具体降落在后续剧情结算）", "gold");
      if (WK.save && WK.save.write) WK.save.write();
      this.render();
    },
    buyReturnReality(){
      const p = this.p();
      if ((p.points || 0) < 50000) { WK.toast("需要 50000 奖励点", "bad"); return; }
      if (!window.confirm("确认消耗 50000 点回归现实世界？\n（本集演示：记录回归标记，不强制结束存档）")) return;
      if (!this._charge(50000, "主神兑换 · 回归现实世界")) return;
      p.flags = p.flags || {};
      p.flags.returnedToReality = true;
      WK.toast("已登记「回归现实世界」。下一届轮回将使用回归后人物卡。", "gold");
      if (WK.save && WK.save.write) WK.save.write();
      this.render();
    },

    /* 支线档位仅 S/A/B/C/D 五档。表内「2D」= 消耗 2 个 D，不是单独档位。
       兑换比例（原著）：3 个低档 = 1 个高档，可双向。 */
    _renderBranchExchange(){
      const p = this.p();
      const b = p.branch || { S:0, A:0, B:0, C:0, D:0 };
      const ranks = ["D", "C", "B", "A", "S"];
      let rows = "";
      for (let i = 0; i < ranks.length - 1; i++) {
        const low = ranks[i], high = ranks[i + 1];
        const canUp = (b[low] || 0) >= 3;
        const canDown = (b[high] || 0) >= 1;
        rows += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0;padding:10px;border:1px solid var(--line2);border-radius:8px;background:var(--panel2);">' +
          '<span style="min-width:120px;font-size:13px;"><b>' + low + "</b> ×3 ↔ <b>" + high + "</b> ×1</span>" +
          '<button type="button" class="here-btn" style="padding:6px 12px;" ' + (canUp ? "" : "disabled ") +
          'onclick="WK.SHOP.branchConvert(&quot;' + low + '&quot;,&quot;' + high + '&quot;,true)">升级（扣3' + low + '→+1' + high + "）</button>" +
          '<button type="button" class="here-btn ghost" style="padding:6px 12px;" ' + (canDown ? "" : "disabled ") +
          'onclick="WK.SHOP.branchConvert(&quot;' + high + '&quot;,&quot;' + low + '&quot;,false)">降级（扣1' + high + '→+3' + low + "）</button>" +
          "</div>";
      }
      return '<div class="shop-sect-t" style="margin-top:18px;">支线剧情兑换</div>' +
        '<div style="font-size:12px;color:var(--dim);line-height:1.7;margin-bottom:8px;">' +
        "界面只有 S / A / B / C / D 五档。表内写「2D」「CC」等表示消耗数量（2 个 D、2 个 C），不是额外档位。<br>" +
        "原著比例：<b>3 个低档 = 1 个高档</b>（3D→1C，3C→1B，3B→1A，3A→1S），可反向拆回。" +
        "</div>" +
        '<div style="font-size:13px;margin-bottom:8px;">当前：' +
        ranks.map(function (k) { return k + " <b style=\"color:var(--gold)\">" + (b[k] || 0) + "</b>"; }).join(" · ") +
        "</div>" + rows;
    },
    branchConvert(from, to, isUpgrade){
      const p = this.p();
      if (!p.branch) p.branch = { S:0, A:0, B:0, C:0, D:0 };
      if (isUpgrade) {
        // from=low, to=high: need 3 low
        if ((p.branch[from] || 0) < 3) { WK.toast(from + " 不足 3 个", "bad"); return; }
        p.branch[from] -= 3;
        p.branch[to] = (p.branch[to] || 0) + 1;
        WK.toast("支线兑换：-3" + from + " → +1" + to, "gold");
      } else {
        // from=high, to=low: need 1 high → +3 low
        if ((p.branch[from] || 0) < 1) { WK.toast(from + " 不足", "bad"); return; }
        p.branch[from] -= 1;
        p.branch[to] = (p.branch[to] || 0) + 3;
        WK.toast("支线兑换：-1" + from + " → +3" + to, "gold");
      }
      if (WK.save && WK.save.write) WK.save.write();
      this.render();
    },

    _captainLock(name,desc){
      return this._card("锁","fun",name,desc,'<div class="sc-price"><small>需要队长权限</small></div>',
        '<button class="sc-btn" disabled>未解锁 · 队长权限</button>',"locked");
    },

    /* —— 购买动作：统一走 rules.addPoints 记流水（负数扣款）—— */
    _charge(price, reason){
      const p=this.p();
      if(p.points<price){ WK.toast("奖励点不足","bad"); return false; }
      WK.rules.addPoints(-price, reason); return true;
    },
    _refresh(){ WK.save && WK.save.write(); this.render(); if(WK.renderWatchHUD) WK.renderWatchHUD(); },

    buyAttr(k,n){
      // 原著：10 奖励点 = 1 点身体素质（六维之一）
      const p = this.p();
      const cost = n * 10;
      const label = (this.ATTRS.find(a => a.k === k) || {}).name || k;
      if (!this._charge(cost, "主神兑换 · 强化" + label + " +" + n)) return;
      p.attrs[k] = (p.attrs[k] || 100) + n;
      WK.toast(label + " +" + n + "（消耗 " + cost + " 点）", "gold");
      this._refresh();
    },
    buySkill(id,price){
      const def=WK.SKILL_DEF[id]; if(!def) return;
      if(this.ownedSkill(id)){ WK.toast("已经拥有了","bad"); return; }
      if(!this._charge(price,"主神兑换 · "+def.name)) return;
      const p=this.p(); p.skills=p.skills||{}; p.skills[id]={level:1, t:Date.now()};
      WK.toast("习得「"+def.name+"」","gold");
      this._refresh();
    },
    buyItem(id,price){
      const p = this.p();
      if (!p.branch) p.branch = { S:0, A:0, B:0, C:0, D:0 };
      const def = WK.ITEM_DEF[id];
      // 全表查找（科技 / 传说魔法）
      let cat = null;
      if (WK.CATALOG) {
        ["tech", "magic", "aux", "fun"].forEach(function (ck) {
          if (cat) return;
          const list = WK.CATALOG[ck] || [];
          for (let i = 0; i < list.length; i++) {
            if (list[i].id === id) { cat = list[i]; break; }
          }
        });
      }
      // 血族法术：需血族能量
      if (cat && WK.Blood && WK.Blood.isBloodSkill && WK.Blood.isBloodSkill(cat)) {
        WK.Blood.buyBloodSkill(cat);
        return;
      }
      // 血统 / 基因 / 模板：走血统系统（动画 + 写入 bloodlines）
      if (cat && WK.Blood && WK.Blood.isBloodlineItem(cat)) {
        WK.Blood.buyFromShop(cat);
        return;
      }
      // 豆包v172：辅助技能——扣费前先判“已掌握”，避免重复扣点
      if (def && def.bind === "skill") {
        const sid = def.skillId || id;
        if (p.skills && p.skills[sid]) { WK.toast("已经掌握「" + (def.name || id) + "」", "bad"); return; }
      }
      // 豆包v173：能量池强化（气功等）——已有不低于此档的上限就拦，避免重复花点
      if (def && def.bind === "pool" && WK.Blood) {
        const cur = (WK.Blood.ensurePools(p)[def.poolKey] || {}).max || 0;
        if (cur >= def.poolMax) { WK.toast("你的" + (WK.Blood.POOL_META[def.poolKey] || {}).name + "修为已不低于此境界", "bad"); return; }
      }
      const NAME = { vit_hp: "生命强化", vit_sta: "体力强化", antiviral: "抗病毒血清", ring_naring: "纳戒" };
      // 解析支线：D / 2D / C / B / A / S / DD
      function parseBranchNeed(br) {
        if (!br) return null;
        const s = String(br).toUpperCase().replace(/\s/g, "");
        let n = 1, letter = s;
        const m = s.match(/^(\d+)?([SABCD])$/);
        if (m) { n = parseInt(m[1] || "1", 10); letter = m[2]; }
        else if (s === "DD" || s === "双D") { n = 2; letter = "D"; }
        else if (s === "CC" || s === "双C") { n = 2; letter = "C"; }
        else if (s === "BB" || s === "双B") { n = 2; letter = "B"; }
        else if (s === "AA" || s === "双A") { n = 2; letter = "A"; }
        else if (s === "SS" || s === "双S") { n = 2; letter = "S"; }
        else { letter = s.replace(/[^SABCD]/g, "") || "D"; n = parseInt(s.replace(/[^0-9]/g, "") || "1", 10) || 1; }
        return { n: n, letter: letter };
      }
      if (cat && cat.branch) {
        const need = parseBranchNeed(cat.branch);
        const have = (p.branch && p.branch[need.letter]) || 0;
        if (have < need.n) {
          WK.toast("需要 " + cat.branch + " 恐怖支线（当前 " + need.letter + "：" + have + "）", "bad");
          return;
        }
      }
      // 价格：严格用表内价；倍率弹用 mul 点作许可价
      if (cat) {
        if (cat.price != null && cat.price !== "") price = cat.price;
        else if (cat.priceMul) price = cat.priceMul;
      }
      // 小数价格（如 0.1 点/箭）至少收 1 点，一次买 10 支等价可后续扩展
      if (typeof price === "number" && price > 0 && price < 1) price = 1;
      if (id === "ring_naring" && WK.inv.count(id) > 0) { WK.toast("纳戒有一枚就够了", "bad"); return; }
      if (def && def.bind === "equip" && WK.inv.count(id) > 0 && (id === "ring_naring" || def.unique || def.infinite || (cat && cat.infinite))) {
        WK.toast("已拥有「" + (def.name || id) + "」", "bad"); return;
      }
      if (price == null || price < 0) {
        // 表内仅支线、无点数：允许 0 点 + 支线
        if (cat && cat.branch) price = 0;
        else { WK.toast("该条目暂无法定价兑换", "bad"); return; }
      }
      const dispName = NAME[id] || (def && def.name) || (cat && cat.name) || id;
      if (!this._charge(price, "主神兑换 · " + dispName)) return;
      // ★ 真正消耗支线剧情
      if (cat && cat.branch) {
        const need = parseBranchNeed(cat.branch);
        p.branch[need.letter] = Math.max(0, (p.branch[need.letter] || 0) - need.n);
        WK.toast("消耗支线 " + need.letter + "×" + need.n + "（剩余 " + p.branch[need.letter] + "）", "gold");
      }
      if (id === "vit_hp") { p.maxHp = (p.maxHp || 100) + 20; p.hp = p.maxHp; WK.toast("生命上限 +20", "gold"); }
      else if (id === "vit_sta") {
        p.res = p.res || {}; p.res.maxStamina = (p.res.maxStamina || 60) + 30; p.res.stamina = p.res.maxStamina; WK.toast("体力上限 +30", "gold");
      } else if (id === "antiviral") { WK.inv.add("antiviral", 1); WK.toast("抗病毒血清已入袋（不占格）", "gold"); }
      else if (def && def.bind === "pool") {
        // 豆包v173：修炼强化（气功等）开启 / 提升能量池，不入背包也不占技能格
        const pmeta = (WK.Blood.POOL_META[def.poolKey] || {});
        WK.Blood.grantPool(def.poolKey, def.poolMax, id);
        WK.toast("气感贯通——【" + (pmeta.name || "能量") + "】池开辟，上限 " + def.poolMax + "。" + (pmeta.name === "内力" ? "武功类技能现在可以施展了。" : ""), "gold");
      } else if (def && def.bind === "skill") {
        // 豆包v172：辅助类技能——扣费后写入 p.skills（进战斗技能栏），不进背包
        const sid = def.skillId || id;
        p.skills = p.skills || {}; p.skills[sid] = { level:1, t:Date.now() };
        WK.toast("掌握技能「" + (def.name || id) + "」" + (def.skillReady ? "" : "（需「" + (def.energyLabel || "对应") + "」能量体系后可施放）"), "gold");
      } else if (def && (def.bind === "equip" || def.slot)) {
        WK.inv.addForce(id, 1);
        const slot = WK.combat.slotOf(id);
        if (slot && p.equip && !p.equip[slot]) { WK.combat.wear(id); }
        else WK.toast("「" + (def.name || id) + "」已入背包，请到「人物→装备」装上", "gold");
      } else if (def) { WK.inv.addForce(id, 1); WK.toast("「" + def.name + "」已入袋", "gold"); }
      else if (cat) { WK.inv.addForce(id, 1); WK.toast("「" + cat.name + "」已入袋", "gold"); }
      else WK.toast("兑换完成", "gold");
      if (WK.save && WK.save.write) WK.save.write();
      this._refresh();
    },
    useItem(id){
      // 豆包v128：药剂使用统一收口到 WK.Items（背包与光球两处行为一致）
      if (id === "antiviral") { WK.Items.useAntiviral(); this._refresh(); }
    },
    repair(){
      const p=this.p();
      p.hp=p.maxHp||100;
      if(p.res){ p.res.stamina=p.res.maxStamina||60; }
      const was=!!p.flags.infected; p.flags.infected=false;
      if(p.flags.tVirusPrimed){ p.flags.tVirusPrimed=false; }  // 豆包v128：靠主神修复压下病毒＝试炼中断，不算开基因锁
      const shN=(WK.Shield&&WK.Shield.recharge)?WK.Shield.recharge():0;  // 豆包v177：可充能护符/冰晶护盾回满
      WK.log("reward","主神光柱扫过全身，伤口愈合、体力回满"+(was?"，T 病毒被清除":"")+(shN?"，护符与护盾的能量重新充满":"")+"。");
      WK.toast(shN?("全身修复完成，"+shN+" 面护罩已充满"):"全身修复完成","gold");
      if(WK.renderScene) WK.renderScene();
      this.render();
    },

    /* 场景入口：在光球房渲染「触碰光球」按钮（N14 关 FREE_ROAM 后依旧有效）*/
    renderOrbEntry(room){
      const el=document.getElementById("encounter-container"); if(!el) return;
      if(room && room.id==="g_orb" || WK.P.location==="g_orb"){
        el.innerHTML='<button class="orb-btn" onclick="WK.SHOP.open()">✦ 触碰主神光球 · 兑换 / 修复'+
          '<span class="orb-sub">属性强化 · 科技 · 辅助（魔法 / 武功 / 机甲后续开放）</span></button>';
      }
    }
  };


  /* ============================================================
   * 豆包N13：光球首次引导事件（第一集回归后第一次走进 g_orb）
   * ============================================================ */
  WK.STORY13 = {
    register(){
      const E=WK.EVENTS;
      E.n13_orb = { once:true,
        when:{ trigger:"enter", room:"g_orb", if:p=>!!p.flags.returned },
        script:{ id:"n13_orb", lock:false, title:"主神光球",
        steps:[
          { narr:"你走向那颗悬浮的金色光球。越靠近，脑海中流淌的信息越清晰——血统、功法、枪械、机甲、丹药、甚至回到现实的天数，分门别类，浩如烟海。" },
          { who:"zhangjie", say:"（跟了上来，难得没有吊儿郎当）第一次兑换别急着乱花。新人这一千来点，最值的是六维属性和一把趁手的枪；魔法武功那些，得有对应的恐怖支线剧情才换得了，现在看看就行。" },
          { who:"zhangjie", say:"想换什么，用意识跟光球「说」就行。伤了染了毒，也能在这儿全身修复。我在广场等你，整理好了，咱们这一集就算真正活下来了。" },
          { god:"触碰光球，开始第一次兑换。本集开放【属性强化 / 科技 / 辅助】；魔法传说、武功、机甲、娱乐将在后续恐怖片解锁。" },
          { choices:[ { text:"（伸出手，触碰那颗温暖的光球。）", primary:true } ] }
        ],
        onDone(){ WK.SHOP.open("other"); }
        }
      };
    }
  };
  WK.STORY13.register();


  // 豆包N3：当前所在区域 id（由房间推导，不进存档）

  WK.zoneOf = function (roomId) {
    const r = WK.ROOMS[roomId];
    return r ? r.zone : "train_in";
  };
  WK.zoneMeta = function (zoneId) {
    return WK.ZONES.find(z => z.id === zoneId) || WK.ZONES[0];
  };
  // 豆包N3：短名（方位图/小地图用，避免长名换行；顶栏仍用全名）
  WK.roomShort = function (id) {
    const r = WK.ROOMS[id];
    return r ? (r.short || r.name) : id;
  };
  // 豆包N3：读档/传送后兜底，防止 location 指向不存在的房间
  WK.assertLocation = function () {
    if (WK.P && !WK.ROOMS[WK.P.location]) WK.P.location = "ti_a";
  };

