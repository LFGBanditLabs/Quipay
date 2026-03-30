export interface MockNft {
  id: number;
  name: string;
  floor: number;
}

export const MOCK_NFTS: MockNft[] = [
  { id: 1, name: "Stacks Ape Club #128", floor: 640 },
  { id: 2, name: "Megapont Ape #42", floor: 485 },
  { id: 3, name: "Bitcoin Monkeys #903", floor: 310 },
  { id: 4, name: "Ordinal Punk #77", floor: 920 },
];
