import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter } from "expo-router";

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    const timeout = setTimeout(() => {
      router.replace("/dashboard-builder");
    }, 0);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <ActivityIndicator size="large" />
    </View>
  );
}



/*import { Redirect } from "expo-router";

export default function Page() {
  return <Redirect href="/dashboard-builder" />;
}*/
