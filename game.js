const GAME_WIDTH = 1536;
const GAME_HEIGHT = 1024;
const ACTIVE_AREA = {
  x: 0,
  y: 0,
  width: GAME_WIDTH,
  height: GAME_HEIGHT - 100,
};

const ACTIVE_BOTTOM_Y = ACTIVE_AREA.y + ACTIVE_AREA.height;
const BED_PLATFORM_HEIGHT = 6;
const BED_TOP_Y = 410;
const BED_SURFACE = {
  x: 673,
  y: BED_TOP_Y + BED_PLATFORM_HEIGHT / 2,
  width: 1384,
  height: BED_PLATFORM_HEIGHT,
};

const WALK_SPEED = 275;
const JUMP_SPEED = 1047;
const WALK_FRAME_MS = 180;
const SHOW_DEBUG_LINE = true;
const DOUBLE_JUMP_COUNT = 2;
const AI_SPEED_MIN = 80;
const AI_SPEED_MAX = 170;
const AI_DECISION_MS_MIN = 900;
const AI_DECISION_MS_MAX = 2400;
const AI_JUMP_CHANCE = 0.25;
const HEART_LIFETIME_MS = 1000;
const HEART_COOLDOWN_MS = 900;
const GROUND_GRACE_MS = 120;
const SLEEP_DURATION_MS = 6000;
const BED_SLEEP_TOLERANCE = 18;
let NEXT_CHARACTER_ID = 1;

const CHARACTER_TYPES = {
  pony: {
    scale: 0.27,
    bodySize: { width: 0.32, height: 0.18 },
    bodyOffset: { x: 0.34, y: 0.78 },
    textures: {
      stand: { left: "pony-stand-left", right: "pony-stand-right" },
      walk: { left: "pony-walk-left", right: "pony-walk-right" },
      jump: { left: "pony-jump-left", right: "pony-jump-right" },
      sleep: { left: "pony-sleep", right: "pony-sleep" },
    },
  },
  brum: {
    scale: 0.36,
    bodySize: { width: 0.42, height: 0.16 },
    bodyOffset: { x: 0.29, y: 0.82 },
    textures: {
      stand: { left: "brum-stand-left", right: "brum-stand-right" },
      walk: { left: "brum-walk-left", right: "brum-walk-right" },
      jump: { left: "brum-jump-left", right: "brum-jump-right" },
      sleep: { left: "brum-sleep", right: "brum-sleep" },
    },
  },
  penguin: {
    scale: 0.34,
    bodySize: { width: 0.42, height: 0.18 },
    bodyOffset: { x: 0.29, y: 0.76 },
    textures: {
      stand: {
        left: "penguin-stand-left",
        right: { key: "penguin-stand-left", flipX: true },
      },
      walk: {
        left: "penguin-walk-left",
        right: "penguin-walk-right",
      },
      jump: {
        left: "penguin-jump-left",
        right: { key: "penguin-jump-left", flipX: true },
      },
      sleep: {
        left: "penguin-sleep",
        right: "penguin-sleep",
      },
    },
  },
  agnes: {
    scale: 0.34,
    bodySize: { width: 0.38, height: 0.18 },
    bodyOffset: { x: 0.31, y: 0.78 },
    textures: {
      stand: {
        left: "agnes-stand-left",
        right: "agnes-stand-right",
      },
      walk: {
        left: { key: "agnes-walk-right", flipX: true },
        right: "agnes-walk-right",
      },
      jump: {
        left: "agnes-jump-left",
        right: { key: "agnes-jump-left", flipX: true },
      },
      sleep: {
        left: "agnes-sleep",
        right: "agnes-sleep",
      },
    },
  },
};

class CharacterActor {
  constructor(scene, config) {
    this.scene = scene;
    this.id = NEXT_CHARACTER_ID;
    NEXT_CHARACTER_ID += 1;
    this.type = config.type;
    this.definition = CHARACTER_TYPES[config.type];
    this.facing = config.facing;
    this.isSelected = false;
    this.state = "standing";
    this.currentPoseKey = null;
    this.jumpsUsed = 0;
    this.walkFrame = 0;
    this.walkTimer = 0;
    this.landingPoseLocked = false;
    this.lastGroundedAt = 0;
    this.lastBodyBottom = null;
    this.sleepUntil = 0;
    this.sleepEmitter = null;
    this.sleepSupportY = null;
    this.aiDirection = config.facing === "left" ? -1 : 1;
    this.aiSpeed = Phaser.Math.Between(AI_SPEED_MIN, AI_SPEED_MAX);
    this.aiDecisionTimer = Phaser.Math.Between(AI_DECISION_MS_MIN, AI_DECISION_MS_MAX);

    this.sprite = scene.physics.add.sprite(
      config.x,
      0,
      this.definition.textures.stand[this.facing]
    );
    this.baseFrameWidth = this.sprite.width;
    this.baseFrameHeight = this.sprite.height;
    this.sprite.setScale(this.definition.scale);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setBounce(0);
    this.setDefaultBody();
    this.alignFeetTo(config.feetY);
    this.sprite.setVisible(false);

    this.visual = scene.add.sprite(this.sprite.x, this.getBodyBottomWorld(), this.definition.textures.stand[this.facing]);
    this.visual.setOrigin(0.5, 1);
    this.visual.setScale(this.definition.scale);
    this.visual.setInteractive({ cursor: "pointer" });
    this.visual.on("pointerdown", () => scene.selectCharacter(this));

    scene.physics.add.collider(this.sprite, scene.bed);
    this.syncVisualToBody();
  }

  alignFeetTo(feetY) {
    const bodyBottomFromTop = (this.sprite.body.offset.y + this.sprite.body.height) * this.sprite.scaleY;
    this.sprite.y = feetY - bodyBottomFromTop + this.sprite.displayHeight / 2;
  }

  getBodyBottomWorld() {
    return this.sprite.body.bottom;
  }

  setDefaultBody() {
    this.sprite.body.setSize(
      this.baseFrameWidth * this.definition.bodySize.width,
      this.baseFrameHeight * this.definition.bodySize.height
    );
    this.sprite.body.setOffset(
      this.baseFrameWidth * this.definition.bodyOffset.x,
      this.baseFrameHeight * this.definition.bodyOffset.y
    );
  }

  applyTexture(textureEntry) {
    if (typeof textureEntry === "string") {
      this.visual.setTexture(textureEntry);
      this.visual.setFlipX(false);
    } else {
      this.visual.setTexture(textureEntry.key);
      this.visual.setFlipX(Boolean(textureEntry.flipX));
    }
  }

  syncVisualToBody() {
    this.visual.setPosition(this.sprite.body.center.x, this.sprite.body.bottom);
  }

  applyPose(poseKey, state, textureEntry, bodyMode) {
    if (this.currentPoseKey === poseKey) {
      this.state = state;
      return;
    }

    this.state = state;
    this.currentPoseKey = poseKey;
    this.applyTexture(textureEntry);
    this.syncVisualToBody();
  }

  setSelected(isSelected) {
    this.isSelected = isSelected;

    if (isSelected && this.state === "sleeping") {
      this.wakeUp();
    }

    if (!isSelected) {
      this.aiDecisionTimer = Phaser.Math.Between(AI_DECISION_MS_MIN, AI_DECISION_MS_MAX);
      this.aiSpeed = Phaser.Math.Between(AI_SPEED_MIN, AI_SPEED_MAX);
      if (this.sprite.body.blocked.left) {
        this.aiDirection = 1;
      } else if (this.sprite.body.blocked.right) {
        this.aiDirection = -1;
      }
    }
  }

  update(delta, cursors) {
    if (this.state === "sleeping") {
      if (this.scene.time.now >= this.sleepUntil) {
        this.wakeUp();
      } else {
        this.sprite.setVelocity(0, 0);
        this.sprite.body.allowGravity = false;
        this.lastBodyBottom = this.getBodyBottomWorld();
        this.syncVisualToBody();
        return;
      }
    }

    const rawOnGround =
      this.sprite.body.onFloor() ||
      this.sprite.body.blocked.down ||
      this.sprite.body.touching.down ||
      this.sprite.body.wasTouching.down;

    if (rawOnGround) {
      this.lastGroundedAt = this.scene.time.now;
    }

    this.onBed = this.scene.isCharacterOnBed(this);
    this.onGround = rawOnGround && !this.onBed;
    this.onSupport = this.onGround || this.onBed;

    if (this.onSupport) {
      this.jumpsUsed = 0;
      this.landingPoseLocked = false;
    }

    if (this.isSelected) {
      this.updateSelected(delta, cursors);
      this.lastBodyBottom = this.getBodyBottomWorld();
      this.syncVisualToBody();
      return;
    }

    this.updateAi(delta);
    this.lastBodyBottom = this.getBodyBottomWorld();
    this.syncVisualToBody();
  }

  enterSleep() {
    this.isSelected = false;
    this.state = "sleeping";
    this.sleepUntil = this.scene.time.now + SLEEP_DURATION_MS;
    const supportY = this.onBed ? BED_TOP_Y : ACTIVE_BOTTOM_Y;
    this.sleepSupportY = supportY;
    this.sprite.setVelocity(0, 0);
    this.sprite.body.allowGravity = false;
    this.sprite.body.moves = false;
    this.sprite.setAngularVelocity(0);
    this.facing = "right";
    this.setSleepTexture();
    this.alignFeetTo(supportY);
    this.syncVisualToBody();
    this.startSleepEffect();
  }

  wakeUp() {
    this.sleepUntil = 0;
    const supportY = this.sleepSupportY ?? (this.onBed ? BED_TOP_Y : ACTIVE_BOTTOM_Y);
    this.sleepSupportY = null;
    this.sprite.body.allowGravity = true;
    this.sprite.body.moves = true;
    this.stopSleepEffect();
    this.setStandingTexture();
    this.alignFeetTo(supportY);
    this.syncVisualToBody();
    this.aiDecisionTimer = Phaser.Math.Between(AI_DECISION_MS_MIN, AI_DECISION_MS_MAX);
    this.aiSpeed = Phaser.Math.Between(AI_SPEED_MIN, AI_SPEED_MAX);
  }

  startSleepEffect() {
    this.stopSleepEffect();
    this.scene.spawnSleepText(
      this.visual.x + this.visual.displayWidth * 0.18,
      this.visual.y - this.visual.displayHeight * 0.55
    );
    this.sleepEmitter = this.scene.time.addEvent({
      delay: 2000,
      loop: true,
      callback: () => {
        if (this.state !== "sleeping") {
          return;
        }

        this.scene.spawnSleepText(
          this.visual.x + this.visual.displayWidth * 0.18,
          this.visual.y - this.visual.displayHeight * 0.55
        );
      },
    });
  }

  stopSleepEffect() {
    if (!this.sleepEmitter) {
      return;
    }

    this.sleepEmitter.remove(false);
    this.sleepEmitter = null;
  }

  updateSelected(delta, cursors) {
    const movingLeft = cursors.left.isDown;
    const movingRight = cursors.right.isDown;

    if (movingLeft) {
      this.sprite.setVelocityX(-WALK_SPEED);
      this.facing = "left";
      this.updateWalk(delta, true);
    } else if (movingRight) {
      this.sprite.setVelocityX(WALK_SPEED);
      this.facing = "right";
      this.updateWalk(delta, true);
    } else {
      this.sprite.setVelocityX(0);
      this.setStandingTexture();
    }

    if (Phaser.Input.Keyboard.JustDown(cursors.space) && this.jumpsUsed < DOUBLE_JUMP_COUNT) {
      this.sprite.setVelocityY(-JUMP_SPEED);
      this.jumpsUsed += 1;
      this.landingPoseLocked = false;
      this.setJumpTexture();
    }

    if (!this.onSupport) {
      this.setJumpTexture();
    }
  }

  updateAi(delta) {
    this.aiDecisionTimer -= delta;

    if (this.sprite.body.blocked.left) {
      this.aiDirection = 1;
    } else if (this.sprite.body.blocked.right) {
      this.aiDirection = -1;
    }

    if (this.aiDecisionTimer <= 0) {
      this.aiDirection = Math.random() < 0.5 ? -1 : 1;
      this.aiSpeed = Phaser.Math.Between(AI_SPEED_MIN, AI_SPEED_MAX);
      this.aiDecisionTimer = Phaser.Math.Between(AI_DECISION_MS_MIN, AI_DECISION_MS_MAX);

      if (this.onSupport && Math.random() < AI_JUMP_CHANCE) {
        this.sprite.setVelocityY(-JUMP_SPEED);
        this.jumpsUsed = 1;
        this.landingPoseLocked = false;
        this.setJumpTexture();
      }
    }

    this.sprite.setVelocityX(this.aiDirection * this.aiSpeed);
    this.facing = this.aiDirection < 0 ? "left" : "right";

    if (this.onSupport) {
      this.updateWalk(delta, Math.abs(this.sprite.body.velocity.x) > 0);
    } else {
      this.setJumpTexture();
    }
  }

  updateWalk(delta, isMoving) {
    if (!this.onSupport) {
      this.setJumpTexture();
      return;
    }

    if (!isMoving) {
      this.setStandingTexture();
      return;
    }

    this.walkTimer += delta;
    if (this.walkTimer < WALK_FRAME_MS) {
      return;
    }

    this.walkTimer = 0;
    this.walkFrame = this.walkFrame === 0 ? 1 : 0;
    const frameName = this.walkFrame === 0 ? "stand" : "walk";
    this.setWalkTexture(frameName);
  }

  setStandingTexture() {
    this.walkTimer = 0;
    this.walkFrame = 0;
    this.applyPose(`stand:${this.facing}`, "standing", this.definition.textures.stand[this.facing], "default");
  }

  setJumpTexture() {
    this.walkTimer = 0;
    this.walkFrame = 0;
    this.applyPose(`jump:${this.facing}`, "jumping", this.definition.textures.jump[this.facing], "default");
  }

  setWalkTexture(frameName) {
    this.applyPose(
      `walk:${frameName}:${this.facing}`,
      "walking",
      this.definition.textures[frameName][this.facing],
      "default"
    );
  }

  setSleepTexture() {
    this.walkTimer = 0;
    this.walkFrame = 0;
    this.applyPose(`sleep:${this.facing}`, "sleeping", this.definition.textures.sleep[this.facing], "sleep");
  }
}

class BedroomScene extends Phaser.Scene {
  constructor() {
    super("bedroom-scene");
  }

  preload() {
    this.load.image("bedroom", "public/assets/backgrounds/bedroom.png");
    this.load.image("pony-stand-right", "public/assets/sprites/pony/pony-standing-right.png");
    this.load.image("pony-walk-right", "public/assets/sprites/pony/pony-walk-right.png");
    this.load.image("pony-jump-right", "public/assets/sprites/pony/pony-jump-right.png");
    this.load.image("pony-stand-left", "public/assets/sprites/pony/pony-standing-left.png");
    this.load.image("pony-walk-left", "public/assets/sprites/pony/pony-walk-left.png");
    this.load.image("pony-jump-left", "public/assets/sprites/pony/pony-jump-left.png");
    this.load.image("pony-sleep", "public/assets/sprites/pony/pony-sleep.png");
    this.load.image("brum-stand-right", "public/assets/sprites/brum/brum-standing-right.png");
    this.load.image("brum-walk-right", "public/assets/sprites/brum/brum-walk-right.png");
    this.load.image("brum-jump-right", "public/assets/sprites/brum/brum-jump-right.png");
    this.load.image("brum-stand-left", "public/assets/sprites/brum/brum-standing-left.png");
    this.load.image("brum-walk-left", "public/assets/sprites/brum/brum-walk-left.png");
    this.load.image("brum-jump-left", "public/assets/sprites/brum/brum-jump-left.png");
    this.load.image("brum-sleep", "public/assets/sprites/brum/brum-sleep.png");
    this.load.image("penguin-stand-left", "public/assets/sprites/penguin/penguin-standing-left.png");
    this.load.image("penguin-walk-right", "public/assets/sprites/penguin/penguin-walk-right.png");
    this.load.image("penguin-jump-left", "public/assets/sprites/penguin/penguin-jump-left.png");
    this.load.image("penguin-walk-left", "public/assets/sprites/penguin/penguin-walk-left.png");
    this.load.image("penguin-sleep", "public/assets/sprites/penguin/penguin-sleep.png");
    this.load.image("agnes-stand-left", "public/assets/sprites/agnes/agnes-standing-left.png");
    this.load.image("agnes-stand-right", "public/assets/sprites/agnes/agnes-standing-right.png");
    this.load.image("agnes-walk-right", "public/assets/sprites/agnes/agnes-walk-right.png");
    this.load.image("agnes-jump-left", "public/assets/sprites/agnes/agnes-jump-left.png");
    this.load.image("agnes-sleep", "public/assets/sprites/agnes/agnes-sleep.png");
  }

  create() {
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "bedroom");

    this.cursors = this.input.keyboard.createCursorKeys();
    this.sleepKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.physics.world.setBounds(ACTIVE_AREA.x, ACTIVE_AREA.y, ACTIVE_AREA.width, ACTIVE_AREA.height);

    const bed = this.add.rectangle(
      BED_SURFACE.x,
      BED_SURFACE.y,
      BED_SURFACE.width,
      BED_SURFACE.height,
      0x000000,
      0
    );
    this.physics.add.existing(bed, true);
    this.bed = bed;

    this.platforms = this.physics.add.staticGroup();
    this.platforms.add(bed);

    this.characters = [
      new CharacterActor(this, { type: "pony", x: 180, feetY: ACTIVE_BOTTOM_Y, facing: "right" }),
      new CharacterActor(this, { type: "brum", x: 1000, feetY: ACTIVE_BOTTOM_Y, facing: "left" }),
      new CharacterActor(this, { type: "penguin", x: 1320, feetY: ACTIVE_BOTTOM_Y, facing: "left" }),
      new CharacterActor(this, { type: "agnes", x: 860, feetY: ACTIVE_BOTTOM_Y, facing: "right" }),
    ];

    this.characterCollisionTimes = new Map();
    this.setupCharacterCollisions();

    this.selectCharacter(this.characters[0]);

    if (SHOW_DEBUG_LINE) {
      this.add.rectangle(
        ACTIVE_AREA.x + ACTIVE_AREA.width / 2,
        ACTIVE_AREA.y + ACTIVE_AREA.height / 2,
        ACTIVE_AREA.width,
        ACTIVE_AREA.height
      )
        .setStrokeStyle(4, 0x2f7cf6, 0.9)
        .setFillStyle(0x2f7cf6, 0.04);

      this.add.line(
        0,
        0,
        BED_SURFACE.x - BED_SURFACE.width / 2,
        BED_TOP_Y,
        BED_SURFACE.x + BED_SURFACE.width / 2,
        BED_TOP_Y,
        0xff4f7d,
        0.85
      )
        .setOrigin(0, 0)
        .setLineWidth(4, 4);

      this.add.rectangle(
        BED_SURFACE.x,
        BED_SURFACE.y,
        BED_SURFACE.width,
        BED_SURFACE.height
      )
        .setStrokeStyle(3, 0xff9f1c, 0.95)
        .setFillStyle(0xff9f1c, 0.08);

    }

    this.add.text(24, 24, "Click a sprite to control it. Arrows: move   Space: jump   Z: Sleep", {
      fontSize: "28px",
      color: "#3b1f2e",
      backgroundColor: "rgba(255,255,255,0.55)",
      padding: { x: 12, y: 8 },
    });

    this.debugPanel = this.add
      .text(24, 92, "", {
        fontSize: "22px",
        color: "#2f1c24",
        backgroundColor: "rgba(255,255,255,0.72)",
        padding: { x: 12, y: 10 },
      })
      .setDepth(20)
      .setScrollFactor(0);

    this.selectionMarker = this.add
      .text(0, 0, "⭐", {
        fontSize: "28px",
      })
      .setOrigin(0.5)
      .setDepth(25)
      .setVisible(false);

    this.winBox = this.add.graphics().setDepth(40).setVisible(false);
    this.winText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "Grattis - alla sover", {
        fontSize: "42px",
        color: "#111111",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(41)
      .setVisible(false);
  }

  setupCharacterCollisions() {
    for (let i = 0; i < this.characters.length; i += 1) {
      for (let j = i + 1; j < this.characters.length; j += 1) {
        const first = this.characters[i];
        const second = this.characters[j];
        this.physics.add.collider(first.sprite, second.sprite, () => {
          this.handleCharacterCollision(first, second);
        });
      }
    }
  }

  isCharacterOnBed(character) {
    const body = character.sprite.body;
    if (!body) {
      return false;
    }

    const spriteLeft = body.left;
    const spriteRight = body.right;
    const bodyBottom = body.bottom;
    const overlapsBed =
      spriteRight > BED_SURFACE.x - BED_SURFACE.width / 2 &&
      spriteLeft < BED_SURFACE.x + BED_SURFACE.width / 2;
    const withinBedVerticalBand = Math.abs(bodyBottom - BED_TOP_Y) <= BED_SLEEP_TOLERANCE;
    const isSupported =
      body.blocked.down ||
      body.touching.down ||
      body.wasTouching.down ||
      body.onFloor();

    return overlapsBed && withinBedVerticalBand && isSupported;
  }

  handleCharacterCollision(first, second) {
    if (!first.isSelected) {
      first.aiDirection = first.sprite.x <= second.sprite.x ? -1 : 1;
      first.aiDecisionTimer = Phaser.Math.Between(AI_DECISION_MS_MIN, AI_DECISION_MS_MAX);
    }

    if (!second.isSelected) {
      second.aiDirection = second.sprite.x <= first.sprite.x ? -1 : 1;
      second.aiDecisionTimer = Phaser.Math.Between(AI_DECISION_MS_MIN, AI_DECISION_MS_MAX);
    }

    const key = first.id < second.id ? `${first.id}:${second.id}` : `${second.id}:${first.id}`;
    const now = this.time.now;
    const lastCollision = this.characterCollisionTimes.get(key) ?? -Infinity;

    if (now - lastCollision < HEART_COOLDOWN_MS) {
      return;
    }

    this.characterCollisionTimes.set(key, now);
    this.spawnHeart(
      (first.sprite.x + second.sprite.x) / 2,
      Math.min(first.visual.y, second.visual.y) - 80
    );
  }

  spawnHeart(x, y) {
    const heart = this.add
      .text(x, y, "❤️", {
        fontSize: "34px",
      })
      .setOrigin(0.5)
      .setDepth(30);

    this.tweens.add({
      targets: heart,
      y: y - 80,
      alpha: 0,
      duration: HEART_LIFETIME_MS,
      ease: "Cubic.Out",
      onComplete: () => heart.destroy(),
    });
  }

  spawnSleepText(x, y) {
    const sleepText = this.add
      .text(x, y, "Zzz", {
        fontSize: "26px",
        color: "#3b4f8a",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(30);

    this.tweens.add({
      targets: sleepText,
      y: y - 70,
      alpha: 0,
      duration: 1000,
      ease: "Cubic.Out",
      onComplete: () => sleepText.destroy(),
    });
  }

  selectCharacter(nextSelected) {
    this.characters.forEach((character) => {
      character.setSelected(character === nextSelected);
    });

    this.selectedCharacter = nextSelected;
  }

  update(_time, delta) {
    if (
      Phaser.Input.Keyboard.JustDown(this.sleepKey) &&
      this.selectedCharacter &&
      this.selectedCharacter.state !== "sleeping" &&
      this.isCharacterOnBed(this.selectedCharacter)
    ) {
      this.selectedCharacter.enterSleep();
      this.selectedCharacter = null;
    }

    this.characters.forEach((character) => {
      character.update(delta, this.cursors);
    });

    this.updateSelectionMarker();
    this.updateDebugPanel();
    this.updateWinState();
  }

  updateSelectionMarker() {
    if (!this.selectedCharacter || this.selectedCharacter.state === "sleeping") {
      this.selectionMarker.setVisible(false);
      return;
    }

    this.selectionMarker.setVisible(true);
    this.selectionMarker.setPosition(
      this.selectedCharacter.visual.x,
      this.selectedCharacter.visual.y - this.selectedCharacter.visual.displayHeight - 28
    );
  }

  updateDebugPanel() {
    if (!this.selectedCharacter) {
      this.debugPanel.setText("No active sprite");
      return;
    }

    const { sprite } = this.selectedCharacter;
    this.debugPanel.setText([
      `Active: ${this.selectedCharacter.type}`,
      `State: ${this.selectedCharacter.state}`,
      `Facing: ${this.selectedCharacter.facing}`,
      `On Ground: ${this.selectedCharacter.onGround ? "yes" : "no"}`,
      `On Bed: ${this.isCharacterOnBed(this.selectedCharacter) ? "yes" : "no"}`,
      `Jumps Used: ${this.selectedCharacter.jumpsUsed}/${DOUBLE_JUMP_COUNT}`,
      `Position: ${sprite.x.toFixed(0)}, ${sprite.y.toFixed(0)}`,
      `Velocity: ${sprite.body.velocity.x.toFixed(0)}, ${sprite.body.velocity.y.toFixed(0)}`,
    ]);
  }

  updateWinState() {
    const hasWon = this.characters.every((character) => character.state === "sleeping");

    if (!hasWon) {
      this.winBox.setVisible(false).clear();
      this.winText.setVisible(false);
      return;
    }

    const paddingX = 28;
    const paddingY = 20;
    const bounds = this.winText.getBounds();
    const boxWidth = bounds.width + paddingX * 2;
    const boxHeight = bounds.height + paddingY * 2;
    const boxX = GAME_WIDTH / 2 - boxWidth / 2;
    const boxY = GAME_HEIGHT / 2 - boxHeight / 2;

    this.winBox
      .setVisible(true)
      .clear()
      .fillStyle(0xffffff, 0.8)
      .lineStyle(3, 0x000000, 1)
      .fillRoundedRect(boxX, boxY, boxWidth, boxHeight, 18)
      .strokeRoundedRect(boxX, boxY, boxWidth, boxHeight, 18);

    this.winText.setVisible(true);
  }
}

const config = {
  type: Phaser.AUTO,
  parent: "game-shell",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#f8ece7",
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 1800 },
      debug: true,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BedroomScene],
};

new Phaser.Game(config);
