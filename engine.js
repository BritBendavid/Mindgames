// engine.js

const EMPTY = null;

const PIECE_VALUES = {
  P: 100,
  N: 320,
  B: 330,
  R: 500,
  Q: 900,
  K: 20000,
};

class ChessEngine {
  constructor() {
  this.board = new Array(64).fill(EMPTY);
  this.sideToMove = "w";

  // New full-position state
  this.castlingRights = "KQkq";
  this.enPassantSquare = null;
  this.halfmoveClock = 0;
  this.fullmoveNumber = 1;
  this.positionHistory = [];
}

  loadFEN(fen) {
  const parts = fen.trim().split(/\s+/);

  const boardPart = parts[0];

  this.sideToMove = parts[1] || "w";

  // If FEN includes castling rights, use them.
  // If not, default to KQkq so the simple starting FEN still works.
  if (parts[2] === undefined) {
    this.castlingRights = "KQkq";
  } else {
    this.castlingRights = parts[2] !== "-" ? parts[2] : "";
  }

  this.enPassantSquare =
    parts[3] && parts[3] !== "-" ? this.coordToSquare(parts[3]) : null;

  this.halfmoveClock = parts[4] ? Number(parts[4]) : 0;
  this.fullmoveNumber = parts[5] ? Number(parts[5]) : 1;

  this.board.fill(EMPTY);

  let square = 0;

  for (const char of boardPart) {
    if (char === "/") continue;

    if (/\d/.test(char)) {
      square += Number(char);
    } else {
      const color = char === char.toUpperCase() ? "w" : "b";
      const type = char.toUpperCase();
      this.board[square] = color + type;
      square++;
    }
  }
    this.positionHistory = [this.getPositionKey()];
}

 clone() {
  const copy = new ChessEngine();

  copy.board = [...this.board];
  copy.sideToMove = this.sideToMove;
  copy.castlingRights = this.castlingRights;
  copy.enPassantSquare = this.enPassantSquare;
  copy.halfmoveClock = this.halfmoveClock;
  copy.fullmoveNumber = this.fullmoveNumber;
  copy.positionHistory = [...this.positionHistory];

  return copy;
}

  squareToCoord(square) {
    const file = square % 8;
    const rank = 8 - Math.floor(square / 8);
    return "abcdefgh"[file] + rank;
  }

  coordToSquare(coord) {
    const file = "abcdefgh".indexOf(coord[0]);
    const rank = 8 - Number(coord[1]);
    return rank * 8 + file;
  }

  inBounds(row, col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
  }

  getColor(piece) {
    return piece ? piece[0] : null;
  }

  getType(piece) {
    return piece ? piece[1] : null;
  }

  oppositeColor(color) {
    return color === "w" ? "b" : "w";
  }

  // Important: the public move generator now returns only legal moves.
  generateMoves() {
    return this.generateLegalMoves();
  }

  generateLegalMoves() {
    const pseudoMoves = this.generatePseudoLegalMoves();
    const legalMoves = [];
    const movingColor = this.sideToMove;

    for (const move of pseudoMoves) {
      const target = this.board[move.to];

      // In chess, kings are never captured.
      if (target && target[1] === "K") {
        continue;
      }

      const position = this.clone();
      position.makeMove(move);

      if (!position.isInCheck(movingColor)) {
        legalMoves.push(move);
      }
    }

    return legalMoves;
  }

  generatePseudoLegalMoves() {
    const moves = [];

    for (let square = 0; square < 64; square++) {
      const piece = this.board[square];

      if (!piece) continue;
      if (this.getColor(piece) !== this.sideToMove) continue;

      const type = this.getType(piece);

      if (type === "P") this.generatePawnMoves(square, moves);
      if (type === "N") this.generateKnightMoves(square, moves);

      if (type === "B") {
        this.generateSlidingMoves(square, moves, [
          [1, 1], [1, -1], [-1, 1], [-1, -1],
        ]);
      }

      if (type === "R") {
        this.generateSlidingMoves(square, moves, [
          [1, 0], [-1, 0], [0, 1], [0, -1],
        ]);
      }

      if (type === "Q") {
        this.generateSlidingMoves(square, moves, [
          [1, 1], [1, -1], [-1, 1], [-1, -1],
          [1, 0], [-1, 0], [0, 1], [0, -1],
        ]);
      }

      if (type === "K") {
        this.generateKingMoves(square, moves);
      }
    }

    return moves;
  }

  generatePawnMoves(square, moves) {
    const piece = this.board[square];
    const color = this.getColor(piece);

    const row = Math.floor(square / 8);
    const col = square % 8;

    const direction = color === "w" ? -1 : 1;
    const startRow = color === "w" ? 6 : 1;
    const promotionRow = color === "w" ? 0 : 7;

    const oneStepRow = row + direction;

    if (this.inBounds(oneStepRow, col)) {
      const oneStepSquare = oneStepRow * 8 + col;

      if (!this.board[oneStepSquare]) {
        if (oneStepRow === promotionRow) {
          for (const promo of ["Q", "R", "B", "N"]) {
            moves.push({ from: square, to: oneStepSquare, promotion: promo });
          }
        } else {
          moves.push({ from: square, to: oneStepSquare });
        }

        const twoStepRow = row + direction * 2;

        if (row === startRow && this.inBounds(twoStepRow, col)) {
          const twoStepSquare = twoStepRow * 8 + col;

          if (!this.board[twoStepSquare]) {
            moves.push({
              from: square,
              to: twoStepSquare,
              doublePawnPush: true,
            });
          }
        }
      }
    }

    for (const dc of [-1, 1]) {
      const captureRow = row + direction;
      const captureCol = col + dc;

      if (!this.inBounds(captureRow, captureCol)) continue;

      const targetSquare = captureRow * 8 + captureCol;
      const target = this.board[targetSquare];

      if (target && this.getColor(target) !== color) {
        if (captureRow === promotionRow) {
          for (const promo of ["Q", "R", "B", "N"]) {
            moves.push({ from: square, to: targetSquare, promotion: promo });
          }
        } else {
          moves.push({ from: square, to: targetSquare });
        }
      }

      if (this.enPassantSquare === targetSquare) {
        moves.push({
          from: square,
          to: targetSquare,
          enPassant: true,
        });
      }
    }
  }

  generateKnightMoves(square, moves) {
    const piece = this.board[square];
    const color = this.getColor(piece);

    const row = Math.floor(square / 8);
    const col = square % 8;

    const jumps = [
      [2, 1], [2, -1],
      [-2, 1], [-2, -1],
      [1, 2], [1, -2],
      [-1, 2], [-1, -2],
    ];

    for (const [dr, dc] of jumps) {
      const r = row + dr;
      const c = col + dc;

      if (!this.inBounds(r, c)) continue;

      const targetSquare = r * 8 + c;
      const target = this.board[targetSquare];

      if (!target || this.getColor(target) !== color) {
        moves.push({ from: square, to: targetSquare });
      }
    }
  }

  generateSlidingMoves(square, moves, directions) {
    const piece = this.board[square];
    const color = this.getColor(piece);

    const row = Math.floor(square / 8);
    const col = square % 8;

    for (const [dr, dc] of directions) {
      let r = row + dr;
      let c = col + dc;

      while (this.inBounds(r, c)) {
        const targetSquare = r * 8 + c;
        const target = this.board[targetSquare];

        if (!target) {
          moves.push({ from: square, to: targetSquare });
        } else {
          if (this.getColor(target) !== color) {
            moves.push({ from: square, to: targetSquare });
          }
          break;
        }

        r += dr;
        c += dc;
      }
    }
  }

  generateKingMoves(square, moves) {
    const piece = this.board[square];
    const color = this.getColor(piece);

    const row = Math.floor(square / 8);
    const col = square % 8;

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;

        const r = row + dr;
        const c = col + dc;

        if (!this.inBounds(r, c)) continue;

        const targetSquare = r * 8 + c;
        const target = this.board[targetSquare];

        if (!target || this.getColor(target) !== color) {
          moves.push({ from: square, to: targetSquare });
        }
      }
    }

    this.generateCastlingMoves(square, moves);
  }

  generateCastlingMoves(square, moves) {
    const color = this.sideToMove;
    const enemy = this.oppositeColor(color);

    if (this.isInCheck(color)) return;

    if (color === "w" && square === 60) {
      // White kingside: e1 to g1
      if (
        this.castlingRights.includes("K") &&
        this.board[63] === "wR" &&
        !this.board[61] &&
        !this.board[62] &&
        !this.isSquareAttacked(61, enemy) &&
        !this.isSquareAttacked(62, enemy)
      ) {
        moves.push({ from: 60, to: 62, castle: "K" });
      }

      // White queenside: e1 to c1
      if (
        this.castlingRights.includes("Q") &&
        this.board[56] === "wR" &&
        !this.board[59] &&
        !this.board[58] &&
        !this.board[57] &&
        !this.isSquareAttacked(59, enemy) &&
        !this.isSquareAttacked(58, enemy)
      ) {
        moves.push({ from: 60, to: 58, castle: "Q" });
      }
    }

    if (color === "b" && square === 4) {
      // Black kingside: e8 to g8
      if (
        this.castlingRights.includes("k") &&
        this.board[7] === "bR" &&
        !this.board[5] &&
        !this.board[6] &&
        !this.isSquareAttacked(5, enemy) &&
        !this.isSquareAttacked(6, enemy)
      ) {
        moves.push({ from: 4, to: 6, castle: "k" });
      }

      // Black queenside: e8 to c8
      if (
        this.castlingRights.includes("q") &&
        this.board[0] === "bR" &&
        !this.board[3] &&
        !this.board[2] &&
        !this.board[1] &&
        !this.isSquareAttacked(3, enemy) &&
        !this.isSquareAttacked(2, enemy)
      ) {
        moves.push({ from: 4, to: 2, castle: "q" });
      }
    }
  }

  findKing(color) {
    const king = color + "K";

    for (let i = 0; i < 64; i++) {
      if (this.board[i] === king) {
        return i;
      }
    }

    return -1;
  }

  isInCheck(color) {
    const kingSquare = this.findKing(color);

    if (kingSquare === -1) {
      return true;
    }

    return this.isSquareAttacked(kingSquare, this.oppositeColor(color));
  }

  isSquareAttacked(square, byColor) {
    const row = Math.floor(square / 8);
    const col = square % 8;

    // Pawn attacks
    const pawnSourceRow = row + (byColor === "w" ? 1 : -1);

    for (const dc of [-1, 1]) {
      const pawnCol = col + dc;

      if (this.inBounds(pawnSourceRow, pawnCol)) {
        const pawnSquare = pawnSourceRow * 8 + pawnCol;

        if (this.board[pawnSquare] === byColor + "P") {
          return true;
        }
      }
    }

    // Knight attacks
    const knightJumps = [
      [2, 1], [2, -1],
      [-2, 1], [-2, -1],
      [1, 2], [1, -2],
      [-1, 2], [-1, -2],
    ];

    for (const [dr, dc] of knightJumps) {
      const r = row + dr;
      const c = col + dc;

      if (!this.inBounds(r, c)) continue;

      if (this.board[r * 8 + c] === byColor + "N") {
        return true;
      }
    }

    // King attacks
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;

        const r = row + dr;
        const c = col + dc;

        if (!this.inBounds(r, c)) continue;

        if (this.board[r * 8 + c] === byColor + "K") {
          return true;
        }
      }
    }

    // Bishop and queen diagonal attacks
    const diagonalDirections = [
      [1, 1], [1, -1], [-1, 1], [-1, -1],
    ];

    for (const [dr, dc] of diagonalDirections) {
      let r = row + dr;
      let c = col + dc;

      while (this.inBounds(r, c)) {
        const piece = this.board[r * 8 + c];

        if (piece) {
          if (
            this.getColor(piece) === byColor &&
            (this.getType(piece) === "B" || this.getType(piece) === "Q")
          ) {
            return true;
          }

          break;
        }

        r += dr;
        c += dc;
      }
    }

    // Rook and queen straight attacks
    const straightDirections = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
    ];

    for (const [dr, dc] of straightDirections) {
      let r = row + dr;
      let c = col + dc;

      while (this.inBounds(r, c)) {
        const piece = this.board[r * 8 + c];

        if (piece) {
          if (
            this.getColor(piece) === byColor &&
            (this.getType(piece) === "R" || this.getType(piece) === "Q")
          ) {
            return true;
          }

          break;
        }

        r += dr;
        c += dc;
      }
    }

    return false;
  }

  makeMove(move) {
  const piece = this.board[move.from];
  const color = this.getColor(piece);
  const type = this.getType(piece);
  const capturedPiece = this.board[move.to];

  this.updateCastlingRights(move, piece, capturedPiece);

  this.board[move.to] = move.promotion
    ? color + move.promotion
    : piece;

  this.board[move.from] = EMPTY;

  // En passant capture removes the pawn behind the target square
  if (move.enPassant) {
    const capturedPawnSquare = color === "w" ? move.to + 8 : move.to - 8;
    this.board[capturedPawnSquare] = EMPTY;
  }

  // Move the rook during castling
  if (move.castle) {
    if (move.castle === "K") {
      this.board[61] = this.board[63];
      this.board[63] = EMPTY;
    }

    if (move.castle === "Q") {
      this.board[59] = this.board[56];
      this.board[56] = EMPTY;
    }

    if (move.castle === "k") {
      this.board[5] = this.board[7];
      this.board[7] = EMPTY;
    }

    if (move.castle === "q") {
      this.board[3] = this.board[0];
      this.board[0] = EMPTY;
    }
  }

  // Set en passant target after a double pawn push
  if (type === "P" && Math.abs(move.to - move.from) === 16) {
    this.enPassantSquare = (move.from + move.to) / 2;
  } else {
    this.enPassantSquare = null;
  }

  if (type === "P" || capturedPiece || move.enPassant) {
    this.halfmoveClock = 0;
  } else {
    this.halfmoveClock++;
  }

  if (this.sideToMove === "b") {
    this.fullmoveNumber++;
  }

  this.sideToMove = this.oppositeColor(this.sideToMove);
  this.recordPosition();
}

  updateCastlingRights(move, piece, capturedPiece) {
    if (!piece) return;

    const remove = rights => {
      for (const r of rights) {
        this.castlingRights = this.castlingRights.replace(r, "");
      }
    };

    const type = this.getType(piece);

    if (type === "K") {
      if (this.getColor(piece) === "w") remove("KQ");
      if (this.getColor(piece) === "b") remove("kq");
    }

    if (type === "R") {
      if (move.from === 63) remove("K");
      if (move.from === 56) remove("Q");
      if (move.from === 7) remove("k");
      if (move.from === 0) remove("q");
    }

    if (capturedPiece && this.getType(capturedPiece) === "R") {
      if (move.to === 63) remove("K");
      if (move.to === 56) remove("Q");
      if (move.to === 7) remove("k");
      if (move.to === 0) remove("q");
    }
  }

  evaluate() {
    let score = 0;

    for (const piece of this.board) {
      if (!piece) continue;

      const color = this.getColor(piece);
      const type = this.getType(piece);
      const value = PIECE_VALUES[type];

      score += color === "w" ? value : -value;
    }

    return score;
  }

  search(depth) {
    if (depth === 0) {
      return this.evaluate();
    }

    const moves = this.generateMoves();

    if (moves.length === 0) {
      if (this.isInCheck(this.sideToMove)) {
        return this.sideToMove === "w" ? -999999 : 999999;
      }

      return 0;
    }

    if (this.sideToMove === "w") {
      let bestScore = -Infinity;

      for (const move of moves) {
        const position = this.clone();
        position.makeMove(move);
        const score = position.search(depth - 1);
        bestScore = Math.max(bestScore, score);
      }

      return bestScore;
    } else {
      let bestScore = Infinity;

      for (const move of moves) {
        const position = this.clone();
        position.makeMove(move);
        const score = position.search(depth - 1);
        bestScore = Math.min(bestScore, score);
      }

      return bestScore;
    }
  }

  findBestMove(depth) {
    const moves = this.generateMoves();

    let bestMove = null;
    let bestScore = this.sideToMove === "w" ? -Infinity : Infinity;

    for (const move of moves) {
      const position = this.clone();
      position.makeMove(move);

      const score = position.search(depth - 1);

      if (this.sideToMove === "w" && score > bestScore) {
        bestScore = score;
        bestMove = move;
      }

      if (this.sideToMove === "b" && score < bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return { move: bestMove, score: bestScore };
  }

  perft(depth) {
    if (depth === 0) {
      return 1;
    }

    const moves = this.generateMoves();
    let nodes = 0;

    for (const move of moves) {
      const position = this.clone();
      position.makeMove(move);
      nodes += position.perft(depth - 1);
    }

    return nodes;
  }

  moveToString(move) {
    let text = this.squareToCoord(move.from) + this.squareToCoord(move.to);

    if (move.promotion) {
      text += move.promotion.toLowerCase();
    }

    return text;
  }

getPositionKey() {
  const boardPart = this.board.map(piece => piece || ".").join("");

  const ep = this.enPassantSquare === null
    ? "-"
    : this.squareToCoord(this.enPassantSquare);

  return [
    boardPart,
    this.sideToMove,
    this.castlingRights || "-",
    ep
  ].join(" ");
}

recordPosition() {
  this.positionHistory.push(this.getPositionKey());
}

isThreefoldRepetition() {
  const currentKey = this.getPositionKey();

  let count = 0;

  for (const key of this.positionHistory) {
    if (key === currentKey) {
      count++;
    }
  }

  return count >= 3;
}

isFiftyMoveRule() {
  return this.halfmoveClock >= 100;
}

isInsufficientMaterial() {
  const pieces = [];

  for (let square = 0; square < 64; square++) {
    const piece = this.board[square];
    if (piece) {
      pieces.push({ piece, square });
    }
  }

  const nonKings = pieces.filter(p => p.piece[1] !== "K");

  // King vs king
  if (nonKings.length === 0) {
    return true;
  }

  // King and bishop/knight vs king
  if (nonKings.length === 1) {
    const type = nonKings[0].piece[1];
    return type === "B" || type === "N";
  }

  // King and bishop vs king and bishop with bishops on same color
  if (nonKings.length === 2) {
    const bothBishops = nonKings.every(p => p.piece[1] === "B");

    if (bothBishops) {
      const colors = nonKings.map(p => {
        const row = Math.floor(p.square / 8);
        const col = p.square % 8;
        return (row + col) % 2;
      });

      return colors[0] === colors[1];
    }
  }

  return false;
}

getGameStatus() {
  const legalMoves = this.generateMoves();
  const inCheck = this.isInCheck(this.sideToMove);

  if (legalMoves.length === 0) {
    if (inCheck) {
      return {
        over: true,
        type: "checkmate",
        message: this.sideToMove === "w"
          ? "Checkmate. Black wins."
          : "Checkmate. White wins."
      };
    }

    return {
      over: true,
      type: "stalemate",
      message: "Draw by stalemate."
    };
  }

  if (this.isFiftyMoveRule()) {
    return {
      over: true,
      type: "fifty-move",
      message: "Draw by fifty-move rule."
    };
  }

  if (this.isThreefoldRepetition()) {
    return {
      over: true,
      type: "threefold",
      message: "Draw by threefold repetition."
    };
  }

  if (this.isInsufficientMaterial()) {
    return {
      over: true,
      type: "insufficient-material",
      message: "Draw by insufficient material."
    };
  }

  if (inCheck) {
    return {
      over: false,
      type: "check",
      message: this.sideToMove === "w"
        ? "White is in check."
        : "Black is in check."
    };
  }

  return {
    over: false,
    type: "ongoing",
    message: "Game ongoing."
  };
}

squareRow(square) {
  return Math.floor(square / 8);
}

squareCol(square) {
  return square % 8;
}

squareColor(square) {
  return (this.squareRow(square) + this.squareCol(square)) % 2;
}

analyzeWhitePathsToBlackKing(maxDepth = 14) {
  return this.analyzePathsToKing("w", "b", maxDepth);
}

analyzePathsToKing(attackerColor = "w", defenderColor = "b", maxDepth = 14) {
  const defenderKingSquare = this.findKing(defenderColor);

  if (defenderKingSquare === -1) {
    return {
      target: null,
      targetCoord: null,
      results: [],
      summary: "No defending king found."
    };
  }

  const results = [];

  for (let from = 0; from < 64; from++) {
    const piece = this.board[from];

    if (!piece) continue;
    if (this.getColor(piece) !== attackerColor) continue;

    const type = this.getType(piece);

    if (type === "K") {
      results.push({
        piece,
        from,
        fromCoord: this.squareToCoord(from),
        target: defenderKingSquare,
        targetCoord: this.squareToCoord(defenderKingSquare),
        included: false,
        reason: "Kings are excluded from this path-to-king function.",
        emptyDistance: Infinity,
        blockedDistance: Infinity,
        extraSteps: Infinity,
        route: []
      });

      continue;
    }

    if (
      type === "B" &&
      this.squareColor(from) !== this.squareColor(defenderKingSquare)
    ) {
      results.push({
        piece,
        from,
        fromCoord: this.squareToCoord(from),
        target: defenderKingSquare,
        targetCoord: this.squareToCoord(defenderKingSquare),
        included: false,
        reason: "Bishop is on the opposite color from the Black king.",
        emptyDistance: Infinity,
        blockedDistance: Infinity,
        extraSteps: Infinity,
        route: []
      });

      continue;
    }

    const empty = this.shortestKingCaptureRoute({
      piece,
      from,
      target: defenderKingSquare,
      ignoreBlockers: true,
      maxDepth
    });

    const blocked = this.shortestKingCaptureRoute({
      piece,
      from,
      target: defenderKingSquare,
      ignoreBlockers: false,
      maxDepth
    });

    const emptyDistance = empty.distance;
    const blockedDistance = blocked.distance;

    results.push({
      piece,
      from,
      fromCoord: this.squareToCoord(from),
      target: defenderKingSquare,
      targetCoord: this.squareToCoord(defenderKingSquare),
      included: Number.isFinite(emptyDistance),
      reason: Number.isFinite(emptyDistance)
        ? "Eligible."
        : "No empty-board path found within depth limit.",
      emptyDistance,
      blockedDistance,
      extraSteps:
        Number.isFinite(emptyDistance) && Number.isFinite(blockedDistance)
          ? blockedDistance - emptyDistance
          : Infinity,
      emptyRoute: empty.route,
      route: blocked.route,
      captures: blocked.captures,
      maxDepth
    });
  }

  results.sort((a, b) => {
    if (a.included !== b.included) return a.included ? -1 : 1;
    if (a.blockedDistance !== b.blockedDistance) {
      return a.blockedDistance - b.blockedDistance;
    }
    return a.emptyDistance - b.emptyDistance;
  });

  return {
    target: defenderKingSquare,
    targetCoord: this.squareToCoord(defenderKingSquare),
    results,
    summary:
      "Path-to-king analysis for " +
      attackerColor +
      " pieces against " +
      defenderColor +
      " king on " +
      this.squareToCoord(defenderKingSquare) +
      "."
  };
}

shortestKingCaptureRoute({
  piece,
  from,
  target,
  ignoreBlockers = false,
  maxDepth = 14
}) {
  const startState = {
    square: from,
    type: this.getType(piece),
    captured: new Set()
  };

  const queue = [startState];

  const visited = new Set([
    this.routeStateKey(startState)
  ]);

  const parent = new Map();

  while (queue.length > 0) {
    const state = queue.shift();

    const distance = this.routeDepth(state, parent);

    if (distance >= maxDepth) {
      continue;
    }

    const nextStates = this.getKingCaptureRouteNextStates(
      state,
      piece,
      from,
      target,
      ignoreBlockers
    );

    for (const next of nextStates) {
      const key = this.routeStateKey(next);

      if (visited.has(key)) continue;

      visited.add(key);
      parent.set(key, {
        previous: this.routeStateKey(state),
        state,
        moveTo: next.square,
        capturedSquare: next.capturedSquare || null,
        promotion: next.promotion || null
      });

      if (next.square === target) {
        const route = this.reconstructRoute(next, parent);

        return {
          distance: route.length - 1,
          route: route.map(sq => this.squareToCoord(sq)),
          captures: this.extractRouteCaptures(next, parent),
          finalType: next.type
        };
      }

      queue.push(next);
    }
  }

  return {
    distance: Infinity,
    route: [],
    captures: [],
    finalType: null
  };
}

routeStateKey(state) {
  return (
    state.square +
    "|" +
    state.type +
    "|" +
    [...state.captured].sort((a, b) => a - b).join(",")
  );
}

routeDepth(state, parent) {
  let key = this.routeStateKey(state);
  let depth = 0;

  while (parent.has(key)) {
    depth++;
    key = parent.get(key).previous;
  }

  return depth;
}

reconstructRoute(finalState, parent) {
  const route = [finalState.square];

  let key = this.routeStateKey(finalState);

  while (parent.has(key)) {
    const record = parent.get(key);
    route.push(record.state.square);
    key = record.previous;
  }

  return route.reverse();
}

extractRouteCaptures(finalState, parent) {
  const captures = [];

  let key = this.routeStateKey(finalState);

  while (parent.has(key)) {
    const record = parent.get(key);

    if (record.capturedSquare !== null) {
      captures.push(this.squareToCoord(record.capturedSquare));
    }

    key = record.previous;
  }

  return captures.reverse();
}

getKingCaptureRouteNextStates(
  state,
  originalPiece,
  originalFrom,
  target,
  ignoreBlockers
) {
  const type = state.type;

  if (type === "P") {
    return this.getPawnKingCaptureRouteNextStates(
      state,
      originalPiece,
      originalFrom,
      target,
      ignoreBlockers
    );
  }

  if (type === "N") {
    return this.getKnightKingCaptureRouteNextStates(
      state,
      originalPiece,
      originalFrom,
      target,
      ignoreBlockers
    );
  }

  if (type === "B") {
    return this.getSlidingKingCaptureRouteNextStates(
      state,
      originalPiece,
      originalFrom,
      target,
      ignoreBlockers,
      [
        [1, 1], [1, -1], [-1, 1], [-1, -1]
      ]
    );
  }

  if (type === "R") {
    return this.getSlidingKingCaptureRouteNextStates(
      state,
      originalPiece,
      originalFrom,
      target,
      ignoreBlockers,
      [
        [1, 0], [-1, 0], [0, 1], [0, -1]
      ]
    );
  }

  if (type === "Q") {
    return this.getSlidingKingCaptureRouteNextStates(
      state,
      originalPiece,
      originalFrom,
      target,
      ignoreBlockers,
      [
        [1, 1], [1, -1], [-1, 1], [-1, -1],
        [1, 0], [-1, 0], [0, 1], [0, -1]
      ]
    );
  }

  return [];
}

getRouteOccupant(square, originalPiece, originalFrom, state, ignoreBlockers) {
  if (square === originalFrom) {
    return null;
  }

  if (square === state.square) {
    return null;
  }

  if (ignoreBlockers) {
    return null;
  }

  if (state.captured.has(square)) {
    return null;
  }

  return this.board[square];
}

makeRouteState(previousState, nextSquare, newType = previousState.type, capturedSquare = null) {
  const captured = new Set(previousState.captured);

  if (capturedSquare !== null) {
    captured.add(capturedSquare);
  }

  return {
    square: nextSquare,
    type: newType,
    captured,
    capturedSquare
  };
}

maybePromoteRouteState(state, square, color, capturedSquare = null) {
  const row = this.squareRow(square);
  const promotionRow = color === "w" ? 0 : 7;

  if (row !== promotionRow) {
    return [this.makeRouteState(state, square, "P", capturedSquare)];
  }

  return ["Q", "R", "B", "N"].map(promotionType => {
    const next = this.makeRouteState(state, square, promotionType, capturedSquare);
    next.promotion = promotionType;
    return next;
  });
}

getPawnKingCaptureRouteNextStates(
  state,
  originalPiece,
  originalFrom,
  target,
  ignoreBlockers
) {
  const color = this.getColor(originalPiece);
  const row = this.squareRow(state.square);
  const col = this.squareCol(state.square);

  const direction = color === "w" ? -1 : 1;
  const startRow = color === "w" ? 6 : 1;

  const result = [];

  const oneRow = row + direction;

  // Forward pawn movement. Pawns cannot capture the king forward.
  if (this.inBounds(oneRow, col)) {
    const one = oneRow * 8 + col;
    const oneOccupant = this.getRouteOccupant(
      one,
      originalPiece,
      originalFrom,
      state,
      ignoreBlockers
    );

    if (!oneOccupant && one !== target) {
      result.push(...this.maybePromoteRouteState(state, one, color));

      const twoRow = row + direction * 2;

      if (row === startRow && this.inBounds(twoRow, col)) {
        const two = twoRow * 8 + col;
        const twoOccupant = this.getRouteOccupant(
          two,
          originalPiece,
          originalFrom,
          state,
          ignoreBlockers
        );

        if (!twoOccupant && two !== target) {
          result.push(this.makeRouteState(state, two, "P"));
        }
      }
    }
  }

  // Pawn captures, including the target king.
  for (const dc of [-1, 1]) {
    const captureRow = row + direction;
    const captureCol = col + dc;

    if (!this.inBounds(captureRow, captureCol)) continue;

    const captureSquare = captureRow * 8 + captureCol;

    if (captureSquare === target) {
      result.push(this.makeRouteState(state, captureSquare, "P"));
      continue;
    }

    const occupant = this.getRouteOccupant(
      captureSquare,
      originalPiece,
      originalFrom,
      state,
      ignoreBlockers
    );

    if (!occupant) continue;

    const occupantColor = this.getColor(occupant);

    if (occupantColor !== color) {
      result.push(
        ...this.maybePromoteRouteState(
          state,
          captureSquare,
          color,
          captureSquare
        )
      );
    }
  }

  return result;
}

getKnightKingCaptureRouteNextStates(
  state,
  originalPiece,
  originalFrom,
  target,
  ignoreBlockers
) {
  const color = this.getColor(originalPiece);
  const row = this.squareRow(state.square);
  const col = this.squareCol(state.square);

  const jumps = [
    [2, 1], [2, -1],
    [-2, 1], [-2, -1],
    [1, 2], [1, -2],
    [-1, 2], [-1, -2]
  ];

  const result = [];

  for (const [dr, dc] of jumps) {
    const r = row + dr;
    const c = col + dc;

    if (!this.inBounds(r, c)) continue;

    const nextSquare = r * 8 + c;

    if (nextSquare === target) {
      result.push(this.makeRouteState(state, nextSquare, state.type));
      continue;
    }

    const occupant = this.getRouteOccupant(
      nextSquare,
      originalPiece,
      originalFrom,
      state,
      ignoreBlockers
    );

    if (!occupant) {
      result.push(this.makeRouteState(state, nextSquare, state.type));
      continue;
    }

    if (this.getColor(occupant) !== color) {
      result.push(
        this.makeRouteState(state, nextSquare, state.type, nextSquare)
      );
    }
  }

  return result;
}

getSlidingKingCaptureRouteNextStates(
  state,
  originalPiece,
  originalFrom,
  target,
  ignoreBlockers,
  directions
) {
  const color = this.getColor(originalPiece);
  const row = this.squareRow(state.square);
  const col = this.squareCol(state.square);
  const result = [];

  for (const [dr, dc] of directions) {
    let r = row + dr;
    let c = col + dc;

    while (this.inBounds(r, c)) {
      const nextSquare = r * 8 + c;

      if (nextSquare === target) {
        result.push(this.makeRouteState(state, nextSquare, state.type));
        break;
      }

      const occupant = this.getRouteOccupant(
        nextSquare,
        originalPiece,
        originalFrom,
        state,
        ignoreBlockers
      );

      if (!occupant) {
        result.push(this.makeRouteState(state, nextSquare, state.type));
      } else {
        if (this.getColor(occupant) !== color) {
          result.push(
            this.makeRouteState(state, nextSquare, state.type, nextSquare)
          );
        }

        break;
      }

      r += dr;
      c += dc;
    }
  }

  return result;
}
  
}

if (typeof window !== "undefined") {
  window.ChessEngine = ChessEngine;
}

if (typeof module !== "undefined") {
  module.exports = ChessEngine;
}
