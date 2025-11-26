import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { useLocalDB } from '../../hooks/useLocalDB';

interface Task {
  id?: string;
  title: string;
  completed: boolean;
}

export function LocalDBExample() {
  const [taskTitle, setTaskTitle] = useState('');
  const { data: tasks, loading, error, save, remove, clear, count } = useLocalDB<Task>('tasks');

  const handleAddTask = async () => {
    if (!taskTitle.trim()) return;

    await save({
      title: taskTitle,
      completed: false,
    });

    setTaskTitle('');
  };

  const handleToggleTask = async (task: Task) => {
    await save({
      ...task,
      completed: !task.completed,
    });
  };

  const handleRemoveTask = async (id: string) => {
    await remove(id);
  };

  const handleClearAll = async () => {
    await clear();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>LocalDB Example - Tasks</Text>
      <Text style={styles.count}>Total: {count} tasks</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Nova tarefa"
          value={taskTitle}
          onChangeText={setTaskTitle}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddTask}>
          <Text style={styles.buttonText}>Adicionar</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item._id || ''}
        renderItem={({ item }) => (
          <View style={styles.taskItem}>
            <TouchableOpacity
              style={styles.taskContent}
              onPress={() => handleToggleTask(item)}
            >
              <Text
                style={[
                  styles.taskTitle,
                  item.completed && styles.taskCompleted,
                ]}
              >
                {item.title}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleRemoveTask(item._id || '')}
            >
              <Text style={styles.removeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Nenhuma tarefa</Text>
        }
      />

      {tasks.length > 0 && (
        <TouchableOpacity style={styles.clearButton} onPress={handleClearAll}>
          <Text style={styles.clearButtonText}>Limpar Todas</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F5F5F5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#003B71',
  },
  count: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
  },
  error: {
    color: '#E53E3E',
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#FED7D7',
    borderRadius: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  addButton: {
    backgroundColor: '#003B71',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  taskItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    color: '#2D3748',
  },
  taskCompleted: {
    textDecorationLine: 'line-through',
    color: '#A0AEC0',
  },
  removeButton: {
    padding: 8,
  },
  removeButtonText: {
    color: '#E53E3E',
    fontSize: 20,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    color: '#A0AEC0',
    fontSize: 16,
    marginTop: 40,
  },
  clearButton: {
    backgroundColor: '#E53E3E',
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default LocalDBExample;
