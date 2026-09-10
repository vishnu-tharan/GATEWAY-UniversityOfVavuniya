import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
export async function saveReport({ html }) {
  const file = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync())
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/pdf",
      dialogTitle: "Gateway report",
    });
  else await Print.printAsync({ uri: file.uri });
}
