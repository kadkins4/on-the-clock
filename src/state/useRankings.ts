import { useEffect, useReducer } from "react";
import { boardReducer } from "./reducer";
import { loadBoard, saveBoard } from "../lib/storage";

export function useRankings() {
  const [board, dispatch] = useReducer(boardReducer, undefined, loadBoard);
  useEffect(() => {
    saveBoard(board);
  }, [board]);
  return {
    players: board.lists[board.current],
    dispatch,
    currentList: board.current,
    listNames: Object.keys(board.lists),
  };
}
