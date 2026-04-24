import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { useDataStore } from '../../stores/dataStore';
import { apiCall } from '../../utils/api';
import * as FileSystem from 'expo-file-system';

export default function DatasetsScreen() {
  const { token } = useAuthStore();
  const { datasets, setDatasets, addDataset } = useDataStore();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadDatasets();
  }, [token]);

  const loadDatasets = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const data = await apiCall('/api/datasets', {}, token);
      setDatasets(data);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async () => {
  if (!token) {
    Alert.alert("Please login again");
    return;
  }

  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        "text/csv",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ],
    });

    if (result.canceled) return;

    const file = result.assets[0];
    setUploading(true);

    let base64 = "";

    if (Platform.OS === "web") {
      const response = await fetch(file.uri);
      const blob = await response.blob();

      base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
          const data = reader.result as string;
          resolve(data.split(",")[1]);
        };

        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } else {
          base64 = await FileSystem.readAsStringAsync(file.uri, {
          encoding: "base64" as any,
        });
      
    }

    const fileType = file.name.toLowerCase().endsWith(".csv")
      ? "csv"
      : "xlsx";

    const data = await apiCall(
      "/api/datasets",
      {
        method: "POST",
        body: JSON.stringify({
          name: file.name.replace(/\.(csv|xlsx)$/i, ""),
          file_data: base64,
          file_type: fileType,
        }),
      },
      token
    );

    addDataset(data);
    Alert.alert("Success", "Dataset uploaded successfully");
  } catch (error: any) {
    console.log(error);
    Alert.alert("Upload Failed", error.message || "Upload failed");
  } finally {
    setUploading(false);
  }
};

  /*const handleFileUpload = async () => {
    if (!token) {
      Alert.alert("Please login again");
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      });

      if (result.canceled) return;

      const file = result.assets[0];
      let base64 = "";
      
      if (Platform.OS === "web"){
        const response =await fetch(file.uri);
        const blob = await response.blob();

        base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const data = reader.result as string;
            resolve(data.split(",")[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        base64 = await FileSystem.readAsStringAsync(file.uri, {
          encoding: "base64",
        });
      }
      
      setUploading(true);

      // Read file as base64
      //const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: "base64",
      //});

      const file = result.assets[0];

      // Determine file type
      const fileType = file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'xlsx';
      //file.name.toLowerCase().endsWith('.csv')

      // Upload to backend
      const data = await apiCall(
        '/api/datasets',
        {
          method: 'POST',
          body: JSON.stringify({
            name: file.name.replace(/\.(csv|xlsx)$/, ''),
            file_data: base64,
            file_type: fileType,
          }),
        },
        token
      );

      addDataset(data);
      Alert.alert('Success', 'Dataset uploaded successfully');
    } catch (error: any) {
      //Console.log ("UPLOAD Error:", error);
      Alert.alert('Upload Failed', error.message);
    } finally {
      setUploading(false);
    }
  };*/

  const renderDataset = ({ item }: any) => (
    <TouchableOpacity
      style={styles.datasetCard}
      onPress={() => router.push(`/dataset/${item._id}`)}
    >
      <View style={styles.datasetHeader}>
        <Ionicons name="document-text" size={24} color="#3b82f6" />
        <View style={styles.datasetInfo}>
          <Text style={styles.datasetName}>{item.name}</Text>
          <Text style={styles.datasetMeta}>
            {item.row_count} rows • {item.columns.length} columns
          </Text>
        </View>
      </View>
      <View style={styles.datasetFooter}>
        <Text style={styles.datasetDate}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
        <Ionicons name="chevron-forward" size={20} color="#666" />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Datasets</Text>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={handleFileUpload}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="add" size={24} color="#fff" />
              <Text style={styles.uploadButtonText}>Upload</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : datasets.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cloud-upload-outline" size={80} color="#333" />
          <Text style={styles.emptyText}>No datasets yet</Text>
          <Text style={styles.emptySubtext}>Upload a CSV or Excel file to get started</Text>
        </View>
      ) : (
        <FlatList
          data={datasets}
          renderItem={renderDataset}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshing={loading}
          onRefresh={loadDatasets}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
  },
  datasetCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  datasetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  datasetInfo: {
    marginLeft: 12,
    flex: 1,
  },
  datasetName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  datasetMeta: {
    fontSize: 12,
    color: '#666',
  },
  datasetFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  datasetDate: {
    fontSize: 12,
    color: '#666',
  },
});