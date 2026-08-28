// Helper function to convert numeric amount to Indian Currency Words (Lakhs & Crores format)
export function numberToIndianWords(amount: number): string {
  if (isNaN(amount) || amount === 0) return "Rupees Zero Only";

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];

  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function convertBelowThousand(n: number): string {
    let str = "";
    if (n >= 100) {
      str += ones[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + " ";
      n %= 10;
    }
    if (n > 0) {
      str += ones[n] + " ";
    }
    return str.trim();
  }

  const rounded = Math.round(amount);
  let remaining = rounded;

  let crore = Math.floor(remaining / 10000000);
  remaining %= 10000000;

  let lakh = Math.floor(remaining / 100000);
  remaining %= 100000;

  let thousand = Math.floor(remaining / 1000);
  remaining %= 1000;

  let result = "Rupees ";

  if (crore > 0) {
    result += convertBelowThousand(crore) + " Crore ";
  }
  if (lakh > 0) {
    result += convertBelowThousand(lakh) + " Lakh ";
  }
  if (thousand > 0) {
    result += convertBelowThousand(thousand) + " Thousand ";
  }
  if (remaining > 0) {
    result += convertBelowThousand(remaining) + " ";
  }

  result = result.trim() + " Only";
  return result;
}
