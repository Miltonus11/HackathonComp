import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { MoodDialog } from '@/components/mood-dialog';

const title = 'How are you feeling today?';

describe('MoodDialog', () => {
  it('renders nothing when not visible', async () => {
    await render(<MoodDialog visible={false} lang="en" onSubmit={jest.fn()} />);
    expect(screen.queryByText(title)).toBeNull();
  });

  it('cannot save until the slider is moved, then submits the chosen score and reason', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    await render(<MoodDialog visible lang="en" onSubmit={onSubmit} />);
    expect(screen.getByText(title)).toBeTruthy();

    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();

    await fireEvent(screen.getByLabelText(title), 'valueChange', 8);
    expect(screen.getByText('😄')).toBeTruthy(); // the face for 8
    // 'Happy' is both the word for 8 and the right-hand end label.
    expect(screen.getAllByText('Happy')).toHaveLength(2);

    await fireEvent.press(screen.getByRole('button', { name: 'Sleep' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(8, 'SLEEP'));
  });

  it('keeps the answer and offers a retry when saving fails', async () => {
    const onSubmit = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    await render(<MoodDialog visible lang="en" onSubmit={onSubmit} />);
    await fireEvent(screen.getByLabelText(title), 'valueChange', 3);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await screen.findByText(/could not save/i);
    expect(screen.getByText('😞')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(onSubmit).toHaveBeenLastCalledWith(3, null);
  });

  it('shows Filipino text', async () => {
    await render(<MoodDialog visible lang="fil" onSubmit={jest.fn()} />);
    expect(screen.getByText('Kumusta ang pakiramdam mo ngayon?')).toBeTruthy();
  });
});
