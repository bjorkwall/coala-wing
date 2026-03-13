const GAME_WIDTH = 1536;
const GAME_HEIGHT = 1024;

const FLOOR_Y = 930;
const BED_SURFACE = {
  x: 673,
  y: 410,
  width: 1384,
  height: 24,
};

const PONY_SCALE = 0.27;
const WALK_SPEED = 275;
const JUMP_SPEED = 1047;
const WALK_FRAME_MS = 180;
const SHOW_DEBUG_LINE = false;

class BedroomScene extends Phaser.Scene {
  constructor() {
    super("bedroom-scene");
  }

  preload() {
    this.load.image("bedroom", "public/assets/backgrounds/bedroom.png");
    this.load.image("pony-stand-right", "public/assets/sprites/pony/pony-standing-right.png");
    this.load.image("pony-walk-right", "public/assets/sprites/pony/pony-walk-right.png");
    this.load.image("pony-stand-left", "public/assets/sprites/pony/pony-standing-left.png");
    this.load.image("pony-walk-left", "public/assets/sprites/pony/pony-walk-left.png");
  }

  create() {
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "bedroom");

    this.cursors = this.input.keyboard.createCursorKeys();
    this.walkTimer = 0;
    this.facing = "right";
    this.walkFrame = 0;
    this.jumpsUsed = 0;

    const floor = this.add.rectangle(GAME_WIDTH / 2, FLOOR_Y, GAME_WIDTH, 40, 0x000000, 0);
    this.physics.add.existing(floor, true);

    const bed = this.add.rectangle(
      BED_SURFACE.x,
      BED_SURFACE.y,
      BED_SURFACE.width,
      BED_SURFACE.height,
      0x000000,
      0
    );
    this.physics.add.existing(bed, true);

    this.platforms = this.physics.add.staticGroup();
    this.platforms.add(floor);
    this.platforms.add(bed);

    this.pony = this.physics.add.sprite(170, FLOOR_Y - 90, "pony-stand-right");
    this.pony.setScale(PONY_SCALE);
    this.pony.setCollideWorldBounds(true);
    this.pony.setBounce(0);
    this.pony.body.setSize(this.pony.width * 0.32, this.pony.height * 0.18);
    this.pony.body.setOffset(this.pony.width * 0.34, this.pony.height * 0.78);

    this.physics.add.collider(this.pony, this.platforms);

    if (SHOW_DEBUG_LINE) {
      // This visible guide makes it easy to tune the collision line to the bed art.
      this.add.line(
        0,
        0,
        BED_SURFACE.x - BED_SURFACE.width / 2,
        BED_SURFACE.y,
        BED_SURFACE.x + BED_SURFACE.width / 2,
        BED_SURFACE.y,
        0xff4f7d,
        0.85
      )
        .setOrigin(0, 0)
        .setLineWidth(4, 4);
    }

    this.add.text(24, 24, "Arrows: move   Space: jump", {
      fontSize: "28px",
      color: "#3b1f2e",
      backgroundColor: "rgba(255,255,255,0.55)",
      padding: { x: 12, y: 8 },
    });
  }

  update(_time, delta) {
    const onGround = this.pony.body.blocked.down || this.pony.body.touching.down || this.pony.body.wasTouching.down;
    const movingLeft = this.cursors.left.isDown;
    const movingRight = this.cursors.right.isDown;

    if (onGround) {
      this.jumpsUsed = 0;
    }

    if (movingLeft) {
      this.pony.setVelocityX(-WALK_SPEED);
      this.facing = "left";
      this.updateWalkTexture(delta, onGround);
    } else if (movingRight) {
      this.pony.setVelocityX(WALK_SPEED);
      this.facing = "right";
      this.updateWalkTexture(delta, onGround);
    } else {
      this.pony.setVelocityX(0);
      this.walkTimer = 0;
      this.walkFrame = 0;
      this.pony.setTexture(`pony-stand-${this.facing}`);
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.space) && this.jumpsUsed < 2) {
      this.pony.setVelocityY(-JUMP_SPEED);
      this.jumpsUsed += 1;
      this.pony.setTexture(`pony-stand-${this.facing}`);
    }

    if (!onGround) {
      this.pony.setTexture(`pony-stand-${this.facing}`);
    }
  }

  updateWalkTexture(delta, onGround) {
    if (!onGround) {
      this.pony.setTexture(`pony-stand-${this.facing}`);
      return;
    }

    this.walkTimer += delta;
    if (this.walkTimer < WALK_FRAME_MS) {
      return;
    }

    this.walkTimer = 0;
    this.walkFrame = this.walkFrame === 0 ? 1 : 0;
    const frameName = this.walkFrame === 0 ? "stand" : "walk";
    this.pony.setTexture(`pony-${frameName}-${this.facing}`);
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
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BedroomScene],
};

new Phaser.Game(config);
